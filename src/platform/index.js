'use strict';
// Factory de implementação específica da plataforma.
// Cada plataforma implementa: startHooks(), stopHooks(), detectContext(x, y), performAction(id, ctx)

const windows = require('./windows');
const linux = require('./linux');
const darwin = require('./darwin');

const IMPL = { win32: windows, linux, darwin };

function impl() {
  const p = process.platform;
  const i = IMPL[p];
  if (!i) throw new Error(`RadialFlow não suporta ${p}`);
  return i;
}

module.exports = { impl };
