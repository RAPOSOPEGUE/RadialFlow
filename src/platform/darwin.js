'use strict';
// macOS: AppleScript (System Events/Finder) para ler a seleção do Finder;
// zip/ditto e sips (nativos) para arquivos. Requer permissão de Acessibilidade.

const path = require('node:path');
const { clipboard } = require('electron');
const { scriptsDir, run, withExt, zipTarget } = require('./common');

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

async function performAction(id, ctx) {
  switch (id) {
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
