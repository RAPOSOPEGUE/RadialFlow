'use strict';
// Implementação Linux: xdotool para hooks e contexto, xclip para clipboard.

const { execSync, exec } = require('node:child_process');
const { clipboard } = require('electron');
const { promisify } = require('node:util');

const execAsync = promisify(exec);

function checkDeps() {
  try { execSync('which xdotool xclip 2>/dev/null', { stdio: 'ignore' }); }
  catch { throw new Error('Instale: sudo apt install xdotool xclip (Debian/Ubuntu) ou equivalente'); }
}

let monitorPid = null;

function startHooks(onRightDown, onMove, onRightUp) {
  checkDeps();
  console.log('[linux] hooks: requer permissões de entrada - execute sem sandbox ou configure polkit');
  // Stub: Linux requer mais setup (polkit, permissões de entrada global)
  // Para agora, apenas simulamos
}

function stopHooks() {
  if (monitorPid) {
    try { execSync(`kill ${monitorPid} 2>/dev/null`); } catch {}
    monitorPid = null;
  }
}

async function detectContext(x, y) {
  try {
    const { stdout: name } = await execAsync('xdotool getactivewindow getwindowname 2>/dev/null', { timeout: 200 });
    const nameStr = name.trim().toLowerCase();

    if (nameStr.includes('file') || nameStr.includes('nautilus') || nameStr.includes('dolphin') ||
        nameStr.includes('thunar') || nameStr.includes('pcmanfm')) {
      return { kind: 'file', paths: [], hwnd: 0 };
    }
    if (nameStr.includes('text') || nameStr.includes('editor') || nameStr.includes('code')) {
      return { kind: 'text', hwnd: 0 };
    }
    return { kind: 'unknown', hwnd: 0, paths: [] };
  } catch {
    return { kind: 'unknown', hwnd: 0, paths: [] };
  }
}

async function performAction(id, ctx) {
  switch (id) {
    case 'snapLeft':
      return execAsync('xdotool getactivewindow windowsize 50% 100% 2>/dev/null').catch(() => {});
    case 'snapRight':
      return execAsync('xdotool getactivewindow windowsize 50% 100% windowmove 50% 0 2>/dev/null').catch(() => {});
    case 'maximize':
      return execAsync('wmctrl -r :ACTIVE: -b add,maximized_vert,maximized_horz 2>/dev/null').catch(() => {});
    case 'minimize':
      return execAsync('wmctrl -r :ACTIVE: -b add,hidden 2>/dev/null').catch(() => {});
    case 'paste':
      return execAsync('xdotool key ctrl+v 2>/dev/null').catch(() => {});
    case 'selectAll':
      return execAsync('xdotool key ctrl+a 2>/dev/null').catch(() => {});
    case 'screenshot':
      return execAsync('gnome-screenshot -a 2>/dev/null').catch(() => {});
    case 'showDesktop':
      return execAsync('xdotool key super+d 2>/dev/null').catch(() => {});
    case 'taskView':
      return execAsync('xdotool key super+Tab 2>/dev/null').catch(() => {});
    case 'copyPath':
      if (Array.isArray(ctx.paths)) clipboard.writeText(ctx.paths.join('\n'));
      return;
    default:
      console.log('[linux] ação não suportada:', id);
  }
}

module.exports = { startHooks, stopHooks, detectContext, performAction };
