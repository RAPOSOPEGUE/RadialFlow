'use strict';
// Converte texto e imagens para PDF com o próprio Chromium do Electron (sem dependências).

const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { BrowserWindow } = require('electron');
const { withExt } = require('./platform/common');

const TEXT = new Set(['.txt', '.md', '.csv', '.log', '.json', '.xml', '.ini', '.conf', '.yml', '.yaml']);
const IMAGE = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg']);

const escape = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

async function onePdf(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.pdf') throw new Error(`${path.basename(file)} já é PDF`);
  const win = new BrowserWindow({ show: false, webPreferences: { javascript: false } });
  try {
    if (TEXT.has(ext)) {
      const body = escape(fs.readFileSync(file, 'utf8'));
      const html = '<!doctype html><meta charset="utf-8"><style>body{margin:0}' +
        'pre{font:11pt/1.4 monospace;white-space:pre-wrap;word-wrap:break-word;margin:0}</style>' +
        `<pre>${body}</pre>`;
      await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    } else if (IMAGE.has(ext)) {
      await win.loadURL(pathToFileURL(file).href);
    } else {
      throw new Error(`${path.basename(file)}: tipo não suportado (texto ou imagem)`);
    }
    const pdf = await win.webContents.printToPDF({ printBackground: true });
    fs.writeFileSync(withExt(file, '.pdf'), pdf);
  } finally {
    win.destroy();
  }
}

async function toPdf(paths) {
  if (!paths || !paths.length) throw new Error('Nenhum arquivo selecionado');
  for (const f of paths) await onePdf(f);
}

module.exports = { toPdf };
