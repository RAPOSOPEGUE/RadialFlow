'use strict';
// macOS: AppleScript (System Events/Finder) para contexto e janelas; teclas via uiohook;
// zip/ditto e sips (nativos) para arquivos. Requer permissão de Acessibilidade.

const path = require('node:path');
const { clipboard } = require('electron');
const { keys } = require('../hooks');
const { scriptsDir, run, copySelection, openTranslate, withExt, zipTarget } = require('./common');

function osa(script, args) {
  return run('osascript', [path.join(scriptsDir(), script), ...args.map(String)], { timeout: 5000 });
}

async function detectContext(x, y) {
  try {
    const out = await osa('context-probe-mac.applescript', [Math.round(x), Math.round(y)]);
    const [kind, app, paths = ''] = out.replace(/\n$/, '').split('\t');
    return { kind: kind || 'unknown', app, paths: paths.split(/\r?\n|\r/).filter(Boolean) };
  } catch (err) {
    console.error('[sonda mac]', err.message);
    return { kind: 'unknown', paths: [] };
  }
}

function requirePaths(ctx) {
  if (!ctx.paths || !ctx.paths.length) throw new Error('Nenhum arquivo selecionado no Finder');
  return ctx.paths;
}

async function zip(paths) {
  const dst = zipTarget(paths);
  if (paths.length === 1) {
    return run('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', paths[0], dst]);
  }
  // zip com caminhos relativos à pasta comum, para não gravar o caminho absoluto.
  return run('zip', ['-r', '-q', dst, ...paths.map((p) => path.basename(p))],
    { cwd: path.dirname(paths[0]) });
}

async function unzip(paths) {
  for (const f of paths) {
    const { dir, name } = path.parse(f);
    await run('ditto', ['-x', '-k', f, withExt(path.join(dir, name), '')]);
  }
}

async function convert(paths, format, ext) {
  for (const f of paths) await run('sips', ['-s', 'format', format, f, '--out', withExt(f, ext)]);
}

function place(ctx, half) {
  const { x, y, width, height } = ctx.workArea; // macOS: pontos == DIP do Electron
  const w = half === 'full' ? width : Math.round(width / 2);
  const left = half === 'right' ? x + w : x;
  return osa('place-window-mac.applescript', [left, y, w, height]);
}

async function performAction(id, ctx) {
  switch (id) {
    case 'snapLeft': return place(ctx, 'left');
    case 'snapRight': return place(ctx, 'right');
    case 'maximize': return place(ctx, 'full');
    case 'minimize': return keys('Meta', 'M');
    case 'paste': return keys('Meta', 'V');
    case 'pastePlain': return keys('Meta', 'Alt', 'Shift', 'V');
    case 'selectAll': return keys('Meta', 'A');
    case 'translate': return openTranslate((await copySelection(() => keys('Meta', 'C'))).text);
    case 'screenshot': return keys('Meta', 'Shift', '4');
    case 'showDesktop': return keys('F11');
    case 'taskView': return keys('Ctrl', 'ArrowUp');
    case 'copyPath': return clipboard.writeText(requirePaths(ctx).join('\n'));
    case 'zip': return zip(requirePaths(ctx));
    case 'unzip': return unzip(requirePaths(ctx));
    case 'toPng': return convert(requirePaths(ctx), 'png', '.png');
    case 'toJpg': return convert(requirePaths(ctx), 'jpeg', '.jpg');
    default: throw new Error(`Ação não suportada no macOS: ${id}`);
  }
}

module.exports = {
  start: () => {},
  stop: () => {},
  detectContext,
  performAction,
  // O menu de contexto do macOS abre ao APERTAR; fechamos com Esc ao disparar a roda.
  dismissNativeMenu: true
};
