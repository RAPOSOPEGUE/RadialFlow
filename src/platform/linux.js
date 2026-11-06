'use strict';
// Linux (X11): gesto do mouse via uiohook; a seleção do gerenciador de arquivos é lida
// copiando (Ctrl+C) no momento do gesto, com as teclas enviadas por XTest.

const path = require('node:path');
const { clipboard } = require('electron');
const {
  scriptsDir, run, sleep, copySelection, parsePaths, zipWithPython, unzipWithPython, withExt
} = require('./common');

// O keyTap do uiohook não chega às janelas GTK4 (testado no Nautilus): usa XTest direto.
const keys = (combo) => run('python3', [path.join(scriptsDir(), 'xkeys.py'), combo]);

// Copia a seleção enquanto o gerenciador de arquivos ainda tem o foco.
async function detectContext() {
  // O menu de contexto nativo abre logo após o botão ser apertado; espera ele aparecer,
  // fecha com Esc e só então copia (senão o Ctrl+C vai para o menu).
  await sleep(250);
  await keys('Escape');
  await sleep(150);
  try {
    const { uris } = await copySelection(() => keys('Control_L+c'));
    const paths = parsePaths(uris);
    return paths.length ? { kind: 'file', paths } : { kind: 'unknown', paths: [] };
  } catch (err) {
    console.error('[contexto]', err.message);
    return { kind: 'unknown', paths: [] };
  }
}

async function convertImages(paths, ext) {
  let tool = 'magick';
  try { await run('magick', ['-version']); } catch { tool = 'convert'; }
  for (const f of paths) {
    await run(tool, [f, withExt(f, ext)]).catch((err) => {
      throw new Error(err.message.includes('não está instalado')
        ? 'Instale o ImageMagick: sudo apt install imagemagick' : err.message);
    });
  }
}

async function performAction(id, ctx) {
  switch (id) {
    case 'copyPath': return clipboard.writeText(ctx.paths.join('\n'));
    case 'zip': return zipWithPython(ctx.paths);
    case 'unzip': return unzipWithPython(ctx.paths);
    case 'toPng': return convertImages(ctx.paths, '.png');
    case 'toJpg': return convertImages(ctx.paths, '.jpg');
    default: throw new Error(`Ação não suportada no Linux: ${id}`);
  }
}

module.exports = {
  start: () => {},
  stop: () => {},
  detectContext,
  performAction,
  dismissNativeMenu: false // detectContext fecha o menu no tempo certo
};
