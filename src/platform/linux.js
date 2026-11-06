'use strict';
// Linux (X11 ou XWayland): sonda Python com AT-SPI + xprop/xwininfo para contexto;
// teclas via uiohook (XTest), janelas via wmctrl, zip via python3.

const path = require('node:path');
const { clipboard } = require('electron');
const { keys } = require('../hooks');
const {
  scriptsDir, LineProbe, run, copySelection, parsePaths, openTranslate,
  zipWithPython, unzipWithPython, withExt
} = require('./common');

const probe = new LineProbe('python3', [path.join(scriptsDir(), 'context-probe-linux.py')]);

// Caminhos dos arquivos selecionados: copia no gerenciador de arquivos e lê a área de transferência.
async function selectedPaths() {
  const { uris } = await copySelection(() => keys('Ctrl', 'C'));
  const paths = parsePaths(uris);
  if (!paths.length) throw new Error('Nenhum arquivo selecionado');
  return paths;
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

// Geometria em pixels do X a partir da área útil do monitor (DIP do Electron).
function area(ctx) {
  const { x, y, width, height } = ctx.workArea;
  const s = ctx.scaleFactor || 1;
  return { x: Math.round(x * s), y: Math.round(y * s), w: Math.round(width * s), h: Math.round(height * s) };
}

async function place(ctx, half) {
  const a = area(ctx);
  const w = Math.round(a.w / 2);
  const x = half === 'left' ? a.x : a.x + w;
  await run('wmctrl', ['-r', ':ACTIVE:', '-b', 'remove,maximized_vert,maximized_horz']);
  await run('wmctrl', ['-r', ':ACTIVE:', '-e', `0,${x},${a.y},${w},${a.h}`]);
}

async function performAction(id, ctx) {
  switch (id) {
    case 'snapLeft': return place(ctx, 'left');
    case 'snapRight': return place(ctx, 'right');
    case 'maximize': return run('wmctrl', ['-r', ':ACTIVE:', '-b', 'add,maximized_vert,maximized_horz']);
    case 'minimize': return keys('Meta', 'H'); // atalho padrão do GNOME/Cinnamon
    case 'paste': return keys('Ctrl', 'V');
    case 'pastePlain': return keys('Ctrl', 'Shift', 'V');
    case 'selectAll': return keys('Ctrl', 'A');
    case 'translate': return openTranslate((await copySelection(() => keys('Ctrl', 'C'))).text);
    case 'screenshot': return keys('PrintScreen');
    case 'showDesktop': return keys('Meta', 'D');
    case 'taskView': return keys('Meta');
    case 'copyPath': return clipboard.writeText((await selectedPaths()).join('\n'));
    case 'zip': return zipWithPython(await selectedPaths());
    case 'unzip': return unzipWithPython(await selectedPaths());
    case 'toPng': return convertImages(await selectedPaths(), '.png');
    case 'toJpg': return convertImages(await selectedPaths(), '.jpg');
    default: throw new Error(`Ação não suportada no Linux: ${id}`);
  }
}

module.exports = {
  start: () => probe.start(),
  stop: () => probe.stop(),
  detectContext: (x, y) => probe.ask(x, y),
  performAction,
  // GTK/Qt abrem o menu de contexto ao APERTAR o botão; fechamos com Esc ao disparar a roda.
  dismissNativeMenu: true
};
