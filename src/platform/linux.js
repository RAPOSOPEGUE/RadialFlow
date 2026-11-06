'use strict';
// Linux. Duas situações:
// - X11 (ou XWayland): gesto do mouse via uiohook, contexto pela posição do cursor
//   (AT-SPI + xprop/xwininfo), teclas via XTest, janelas via wmctrl.
// - GNOME Wayland: o sistema não permite gesto global; a roda abre por atalho de teclado,
//   o contexto vem do foco (AT-SPI) e as teclas vão pelo portal RemoteDesktop.

const path = require('node:path');
const { clipboard } = require('electron');
const {
  scriptsDir, LineProbe, run, sleep, copySelection, parsePaths, openTranslate,
  zipWithPython, unzipWithPython, withExt
} = require('./common');

const wayland = process.env.XDG_SESSION_TYPE === 'wayland' && !process.env.RADIALFLOW_FORCE_X11;

const probe = new LineProbe('python3', [path.join(scriptsDir(), 'context-probe-linux.py')]);
// O primeiro envio pode esperar o usuário responder ao diálogo do GNOME: até 2 min.
const portal = wayland
  ? new LineProbe('python3', [path.join(scriptsDir(), 'wayland-keys.py')], 120000,
    { ok: false, error: 'o envio de teclas não respondeu' })
  : null;

// Nomes do uiohook → keysyms do X/portal.
const KEYSYM = {
  Ctrl: 'Control_L', Shift: 'Shift_L', Alt: 'Alt_L', Meta: 'Super_L', PrintScreen: 'Print',
  ArrowLeft: 'Left', ArrowRight: 'Right', ArrowUp: 'Up', ArrowDown: 'Down', Escape: 'Escape'
};

async function keys(...names) {
  const combo = names.map((n) => KEYSYM[n] || n.toLowerCase()).join('+');
  // X11: XTest direto. O keyTap do uiohook não chega às janelas GTK4 (testado no Nautilus).
  if (!wayland) return run('python3', [path.join(scriptsDir(), 'xkeys.py'), combo]);
  const res = await portal.request(combo);
  if (!res.ok) throw new Error(res.error || 'falha ao enviar teclas');
}

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
  if (wayland) return keys('Meta', half === 'left' ? 'ArrowLeft' : 'ArrowRight');
  const a = area(ctx);
  const w = Math.round(a.w / 2);
  const x = half === 'left' ? a.x : a.x + w;
  await run('wmctrl', ['-r', ':ACTIVE:', '-b', 'remove,maximized_vert,maximized_horz']);
  await run('wmctrl', ['-r', ':ACTIVE:', '-e', `0,${x},${a.y},${w},${a.h}`]);
}

async function performAction(id, ctx) {
  // No Wayland a roda tem foco próprio; espera o foco voltar para a janela de destino.
  if (wayland) await sleep(250);
  switch (id) {
    case 'snapLeft': return place(ctx, 'left');
    case 'snapRight': return place(ctx, 'right');
    case 'maximize':
      return wayland ? keys('Meta', 'ArrowUp')
        : run('wmctrl', ['-r', ':ACTIVE:', '-b', 'add,maximized_vert,maximized_horz']);
    case 'minimize': return keys('Meta', 'H'); // atalho padrão do GNOME/Cinnamon
    case 'paste': return keys('Ctrl', 'V');
    case 'pastePlain': return keys('Ctrl', 'Shift', 'V');
    case 'selectAll': return keys('Ctrl', 'A');
    case 'translate': return openTranslate((await copySelection(() => keys('Ctrl', 'C'))).text);
    case 'screenshot': return keys('PrintScreen');
    case 'showDesktop': return keys('Meta', 'D');
    case 'taskView': return keys('Meta');
    case 'copyPath': return clipboard.writeText(ctx.paths.join('\n'));
    case 'zip': return zipWithPython(ctx.paths);
    case 'unzip': return unzipWithPython(ctx.paths);
    case 'toPng': return convertImages(ctx.paths, '.png');
    case 'toJpg': return convertImages(ctx.paths, '.jpg');
    default: throw new Error(`Ação não suportada no Linux: ${id}`);
  }
}

// Copia a seleção no momento do gesto, enquanto o gerenciador de arquivos ainda tem o foco.
// Não usa a sonda AT-SPI: no GTK4 (Nautilus 4x) ela informa posições relativas à janela.
async function detectContext() {
  // O menu de contexto nativo abre logo após o botão ser apertado; espera ele aparecer,
  // fecha com Esc e só então copia (senão o Ctrl+C vai para o menu).
  await sleep(250);
  await keys('Escape');
  await sleep(150);
  try {
    const paths = await selectedPaths();
    return { kind: 'file', paths };
  } catch {
    return { kind: 'unknown', paths: [] };
  }
}

module.exports = {
  wayland,
  start: () => { probe.start(); if (portal) portal.start(); },
  stop: () => { probe.stop(); if (portal) portal.stop(); },
  detectContext,
  detectFocus: () => probe.request('focus'),
  performAction,
  // GTK/Qt abrem o menu de contexto ao APERTAR o botão; detectContext fecha com Esc no tempo certo.
  dismissNativeMenu: false
};
