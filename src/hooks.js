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

const TRIGGER_BUTTON = parseInt(process.env.RADIALFLOW_BUTTON || '2'); // 1=esquerdo, 2=direito (padrão), 3=meio
const debug = !!process.env.RADIALFLOW_DEBUG;

function start({ onRightDown, onMove, onRightUp }) {
  if (!uIOhook) throw new Error(`uiohook-napi não carregou: ${loadError && loadError.message}`);
  uIOhook.on('mousedown', (e) => {
    if (debug) console.log('[hook] mousedown', e.button, 'trigger=', TRIGGER_BUTTON, e.x, e.y);
    if (e.button === TRIGGER_BUTTON) onRightDown(e.x, e.y);
  });
  uIOhook.on('mousemove', (e) => onMove(e.x, e.y));
  uIOhook.on('mousedrag', (e) => onMove(e.x, e.y));
  uIOhook.on('mouseup', (e) => {
    if (debug) console.log('[hook] mouseup', e.button, 'trigger=', TRIGGER_BUTTON, e.x, e.y);
    if (e.button === TRIGGER_BUTTON) onRightUp(e.x, e.y);
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
