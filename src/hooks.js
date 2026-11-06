'use strict';
// Captura global do mouse e envio de teclas via uiohook-napi (Windows, Linux X11, macOS).
// Só eventos de mouse são observados; o teclado é usado apenas para ENVIAR atalhos.

let uIOhook = null;
let UiohookKey = null;
let loadError = null;
try {
  ({ uIOhook, UiohookKey } = require('uiohook-napi'));
} catch (err) {
  loadError = err;
}

const RIGHT_BUTTON = 2; // libuiohook: 1 esquerdo, 2 direito, 3 meio (igual nos 3 sistemas)
const debug = !!process.env.RADIALFLOW_DEBUG;

function start({ onRightDown, onMove, onRightUp }) {
  if (!uIOhook) throw new Error(`uiohook-napi não carregou: ${loadError && loadError.message}`);
  uIOhook.on('mousedown', (e) => {
    if (debug) console.log('[hook] mousedown', e.button, e.x, e.y);
    if (e.button === RIGHT_BUTTON) onRightDown(e.x, e.y);
  });
  uIOhook.on('mousemove', (e) => onMove(e.x, e.y));
  uIOhook.on('mousedrag', (e) => onMove(e.x, e.y)); // movimento com botão pressionado
  uIOhook.on('mouseup', (e) => {
    if (debug) console.log('[hook] mouseup', e.button, e.x, e.y);
    if (e.button === RIGHT_BUTTON) onRightUp(e.x, e.y);
  });
  uIOhook.start();
  if (debug) console.log('[hook] iniciado');
}

function stop() {
  if (!uIOhook) return;
  uIOhook.removeAllListeners();
  uIOhook.stop();
}

// keys('Ctrl', 'V') — último nome é a tecla, os anteriores são modificadores.
function keys(...names) {
  if (!uIOhook) throw new Error('uiohook-napi indisponível para enviar teclas');
  const codes = names.map((n) => {
    const code = UiohookKey[n];
    if (code === undefined) throw new Error(`Tecla desconhecida: ${n}`);
    return code;
  });
  const key = codes.pop();
  uIOhook.keyTap(key, codes);
}

module.exports = { start, stop, keys };
