'use strict';
// Implementação macOS: robotjs para hooks (se disponível), AppleScript para contexto e ações.

const { exec } = require('node:child_process');
const { promisify } = require('node:util');
const { clipboard, shell } = require('electron');

const execAsync = promisify(exec);

let monitor = null;

// Usa osascript (AppleScript) para ações no macOS
function apple(script) {
  return execAsync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, { timeout: 10000 });
}

function startHooks(onRightDown, onMove, onRightUp) {
  // macOS não tem hooks globais fáceis sem dependências. Vamos usar polling.
  const { spawn } = require('node:child_process');
  monitor = spawn('bash', ['-c', `
    while true; do
      # Monitora eventos via Events (requer permissão)
      pythonw - <<'PYTHON' 2>/dev/null &
import Quartz
import time
def callback(proxy, type, event, refcon):
  loc = Quartz.CGEventGetLocation(event)
  btn = Quartz.CGEventGetIntegerValueField(event, Quartz.kCGMouseEventButtonNumber)
  if type == Quartz.kCGEventRightMouseDown:
    print("down:", int(loc.x), int(loc.y))
  elif type == Quartz.kCGEventMouseMoved:
    print("move:", int(loc.x), int(loc.y))
  elif type == Quartz.kCGEventRightMouseUp:
    print("up:", int(loc.x), int(loc.y))
  return event
mask = Quartz.CGEventMaskBit(Quartz.kCGEventRightMouseDown) | \
       Quartz.CGEventMaskBit(Quartz.kCGEventMouseMoved) | \
       Quartz.CGEventMaskBit(Quartz.kCGEventRightMouseUp)
tap = Quartz.CGEventTapCreate(Quartz.kCGHIDEventTap, Quartz.kCGHeadInsertEventTap,
  Quartz.kCGEventTapOptionDefault, mask, callback, None)
loop = Quartz.CFRunLoopGetCurrent()
src = Quartz.CFMachPortCreateRunLoopSource(None, tap, 0)
Quartz.CFRunLoopAddSource(loop, src, Quartz.kCFRunLoopCommonModes)
Quartz.CFRunLoopRun()
PYTHON
      sleep 5
    done
  `]);

  if (monitor && monitor.stdout) {
    monitor.stdout.on('data', (buf) => {
      const line = buf.toString().trim();
      const [cmd, x, y] = line.split(':');
      if (cmd === 'down') onRightDown(parseInt(x), parseInt(y));
      else if (cmd === 'move') onMove(parseInt(x), parseInt(y));
      else if (cmd === 'up') onRightUp(parseInt(x), parseInt(y));
    });
  }
}

function stopHooks() {
  if (monitor) monitor.kill();
  monitor = null;
}

async function detectContext(x, y) {
  try {
    // AppleScript para obter a janela sob o ponto
    const { stdout } = await apple(`
      set loc to {${x}, ${y}}
      tell application "System Events"
        set w to (first window whose bounds contains loc)
        set name to name of w
      end tell
      return name
    `);
    const name = stdout.trim().toLowerCase();

    if (name.includes('finder')) {
      // Tenta obter arquivos selecionados no Finder
      const { stdout: files } = await apple(`
        tell application "Finder"
          set selected to selection
          set result to {}
          repeat with f in selected
            set end of result to (POSIX path of f)
          end repeat
          return result
        end tell
      `).catch(() => ({ stdout: '{}' }));
      try {
        const paths = JSON.parse(files);
        return { kind: 'file', paths, hwnd: 0 };
      } catch {
        return { kind: 'file', paths: [], hwnd: 0 };
      }
    }
    if (name.includes('text') || name.includes('editor') || name.includes('code')) {
      return { kind: 'text', hwnd: 0 };
    }
    return { kind: 'unknown', hwnd: 0 };
  } catch {
    return { kind: 'unknown', hwnd: 0, paths: [] };
  }
}

async function performAction(id, ctx) {
  const paths = Array.isArray(ctx.paths) ? ctx.paths : [];

  if (id === 'copyPath') {
    clipboard.writeText(paths.join('\n'));
    return;
  }

  if (id === 'translate') {
    await apple('tell application "System Events" to keystroke "a" using command down').catch(() => {});
    await apple('tell application "System Events" to keystroke "c" using command down').catch(() => {});
    await new Promise((r) => setTimeout(r, 150));
    try {
      const text = clipboard.readText().trim();
      if (text) {
        const url = 'https://translate.google.com/?sl=auto&tl=pt&op=translate&text=' +
          encodeURIComponent(text.slice(0, 4000));
        await shell.openExternal(url);
      }
    } catch {}
    return;
  }

  switch (id) {
    case 'maximize':
      return apple('tell application "System Events" to key code 126 using command down').catch(() => {});
    case 'minimize':
      return apple('tell application "System Events" to key code 101 using command down').catch(() => {});
    case 'paste':
      return apple('tell application "System Events" to keystroke "v" using command down');
    case 'pastePlain':
      return apple('tell application "System Events" to keystroke "v" using command down shift');
    case 'selectAll':
      return apple('tell application "System Events" to keystroke "a" using command down');
    case 'copySel':
      return apple('tell application "System Events" to keystroke "c" using command down');
    case 'screenshot':
      return apple('do shell script "screencapture -i /tmp/rf_ss.png"').catch(() => {});
    case 'showDesktop':
      return apple('key code 103').catch(() => {});  // F11
    case 'taskView':
      return apple('key code 33 using control down').catch(() => {});
    default:
      console.log('[darwin] ação não suportada:', id);
  }
}

module.exports = { startHooks, stopHooks, detectContext, performAction };
