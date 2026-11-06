'use strict';
// Executa ações. Tudo que mexe no Windows passa por scripts/do-action.ps1,
// com caminhos como argumentos separados (sem montar comando por string).

const { execFile } = require('node:child_process');
const path = require('node:path');
const { clipboard, shell } = require('electron');
const { scriptsDir } = require('./context');

const FILE_ACTIONS = new Set(['zip', 'unzip', 'toPng', 'toJpg']);

function runPs(args) {
  return new Promise((resolve, reject) => {
    if (process.platform !== 'win32') {
      console.log('[simulado] do-action', args.join(' '));
      return resolve();
    }
    execFile('powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
        '-File', path.join(scriptsDir(), 'do-action.ps1'), ...args],
      { windowsHide: true, timeout: 120000 },
      (err, _out, stderr) => (err ? reject(new Error(stderr || err.message)) : resolve()));
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function translateSelection() {
  const previous = clipboard.readText();
  clipboard.clear();
  await runPs(['copySel']);
  await sleep(150);
  const text = clipboard.readText().trim();
  if (previous) clipboard.writeText(previous);
  if (!text) return;
  // O texto selecionado vai para o Google Tradutor no navegador (ação explícita do usuário).
  const url = 'https://translate.google.com/?sl=auto&tl=pt&op=translate&text=' +
    encodeURIComponent(text.slice(0, 4000));
  await shell.openExternal(url);
}

// ctx: { kind, hwnd, paths }
async function perform(id, ctx) {
  const paths = Array.isArray(ctx.paths) ? ctx.paths : [];
  if (id === 'copyPath') {
    clipboard.writeText(paths.join('\n'));
    return;
  }
  if (id === 'translate') return translateSelection();
  if (FILE_ACTIONS.has(id)) {
    if (!paths.length) throw new Error('Nenhum arquivo selecionado');
    return runPs([id, '0', ...paths]);
  }
  return runPs([id, String(ctx.hwnd || 0)]);
}

module.exports = { perform };
