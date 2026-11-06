'use strict';
// Implementação Windows: uiohook-napi + PowerShell para contexto e ações.

const { spawn } = require('node:child_process');
const { execFile } = require('node:child_process');
const path = require('node:path');
const readline = require('node:readline');
const { clipboard, shell } = require('electron');

let uIOhook, UiohookKey;
try { ({ uIOhook, UiohookKey } = require('uiohook-napi')); } catch (e) {
  console.error('[windows] uiohook-napi indisponível:', e.message);
}

let hook = null;
let probe = null;

function scriptsDir() {
  return process.resourcesPath && !process.defaultApp
    ? path.join(process.resourcesPath, 'scripts')
    : path.join(__dirname, '..', '..', 'scripts');
}

function startHooks(onRightDown, onMove, onRightUp) {
  if (!uIOhook) throw new Error('uiohook-napi não instalado. Execute: npm install');
  hook = uIOhook;
  hook.on('mousedown', (e) => { if (e.button === 2) onRightDown(e.x, e.y); });
  hook.on('mousemove', (e) => onMove(e.x, e.y));
  hook.on('mouseup', (e) => { if (e.button === 2) onRightUp(e.x, e.y); });
  hook.start();
}

function stopHooks() {
  if (hook) { hook.removeAllListeners(); hook.stop(); }
}

function startProbe() {
  probe = spawn('powershell.exe', [
    '-NoProfile', '-NoLogo', '-ExecutionPolicy', 'Bypass',
    '-File', path.join(scriptsDir(), 'context-probe.ps1')
  ], { windowsHide: true });
  readline.createInterface({ input: probe.stdout }).on('line', (line) => {
    // resposta em JSON para cada pedido
  });
  probe.stderr.on('data', (d) => console.error('[sonda]', d.toString().trim()));
}

async function detectContext(x, y) {
  if (!probe || !probe.stdin.writable) {
    return { kind: process.env.RADIALFLOW_FAKE_CONTEXT || 'unknown', paths: [], hwnd: 0 };
  }
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ kind: 'unknown', timeout: true }), 700);
    const lines = readline.createInterface({ input: probe.stdout });
    const handler = (line) => {
      clearTimeout(timer);
      lines.removeListener('line', handler);
      try { resolve(JSON.parse(line)); } catch { resolve({ kind: 'unknown' }); }
    };
    lines.on('line', handler);
    probe.stdin.write(`${Math.round(x)} ${Math.round(y)}\n`);
  });
}

function runPs(args) {
  return new Promise((resolve, reject) => {
    execFile('powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
        '-File', path.join(scriptsDir(), 'do-action.ps1'), ...args],
      { windowsHide: true, timeout: 120000 },
      (err) => (err ? reject(err) : resolve()));
  });
}

async function performAction(id, ctx) {
  const paths = Array.isArray(ctx.paths) ? ctx.paths : [];
  if (id === 'copyPath') {
    clipboard.writeText(paths.join('\n'));
    return;
  }
  if (id === 'translate') {
    const prev = clipboard.readText();
    clipboard.clear();
    await runPs(['copySel']);
    await new Promise((r) => setTimeout(r, 150));
    const text = clipboard.readText().trim();
    if (prev) clipboard.writeText(prev);
    if (text) {
      const url = 'https://translate.google.com/?sl=auto&tl=pt&op=translate&text=' +
        encodeURIComponent(text.slice(0, 4000));
      await shell.openExternal(url);
    }
    return;
  }
  if (['zip', 'unzip', 'toPng', 'toJpg'].includes(id)) {
    if (!paths.length) throw new Error('Nenhum arquivo selecionado');
    return runPs([id, '0', ...paths]);
  }
  return runPs([id, String(ctx.hwnd || 0)]);
}

module.exports = { startHooks, stopHooks, detectContext, performAction };
