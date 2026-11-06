'use strict';
// Escolhe a implementação da plataforma. Cada uma exporta:
// start(), stop(), detectContext(x, y) → { kind, ... }, performAction(id, ctx), dismissNativeMenu.

const MODULES = { win32: './windows', linux: './linux', darwin: './darwin' };

function impl() {
  const mod = MODULES[process.platform];
  if (!mod) throw new Error(`RadialFlow não suporta ${process.platform}`);
  return require(mod);
}

module.exports = { impl };
