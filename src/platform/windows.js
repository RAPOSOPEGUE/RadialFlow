'use strict';
// Windows: sonda PowerShell persistente (UI Automation) e scripts/do-action.ps1.

const path = require('node:path');
const { clipboard } = require('electron');
const { scriptsDir, LineProbe, run } = require('./common');

const probe = new LineProbe('powershell.exe', [
  '-NoProfile', '-NoLogo', '-ExecutionPolicy', 'Bypass',
  '-File', path.join(scriptsDir(), 'context-probe.ps1')
]);

function ps(args) {
  return run('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
    '-File', path.join(scriptsDir(), 'do-action.ps1'), ...args]);
}

async function performAction(id, ctx) {
  const paths = Array.isArray(ctx.paths) ? ctx.paths : [];
  if (id === 'copyPath') return clipboard.writeText(paths.join('\r\n'));
  if (!paths.length) throw new Error('Nenhum arquivo selecionado');
  return ps([id, ...paths]);
}

module.exports = {
  start: () => probe.start(),
  stop: () => probe.stop(),
  detectContext: (x, y) => probe.ask(x, y),
  performAction,
  // No Windows o menu de contexto abre ao SOLTAR; a roda absorve o mouseup.
  dismissNativeMenu: false
};
