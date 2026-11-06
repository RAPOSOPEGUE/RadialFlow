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

// Se RADIALFLOW_KEY está setado, usa tecla+movimento. Senão, usa clique do mouse.
const TRIGGER_KEY = process.env.RADIALFLOW_KEY; // ex: 'Shift', 'Ctrl', 'Alt'
const TRIGGER_BUTTON = parseInt(process.env.RADIALFLOW_BUTTON || '2');
const debug = !!process.env.RADIALFLOW_DEBUG;
const keyMode = !!TRIGGER_KEY;

function start({ onRightDown, onMove, onRightUp }) {
  if (!uIOhook) throw new Error(`uiohook-napi não carregou: ${loadError && loadError.message}`);

  if (keyMode) {
    // Modo teclado: pressiona TRIGGER_KEY + move mouse = gesto
    const keyCode = UiohookKey[TRIGGER_KEY];
    if (!keyCode) throw new Error(`Tecla desconhecida: ${TRIGGER_KEY}`);
    let keyPressed = false;
    let startX = 0, startY = 0;
    uIOhook.on('keydown', (e) => {
      if (e.keycode === keyCode && !keyPressed) {
        keyPressed = true;
        if (debug) console.log('[hook] key down', TRIGGER_KEY);
      }
    });
    uIOhook.on('keyup', (e) => {
      if (e.keycode === keyCode && keyPressed) {
        keyPressed = false;
        if (debug) console.log('[hook] key up', TRIGGER_KEY);
        onRightUp(startX, startY);
      }
    });
    uIOhook.on('mousemove', (e) => {
      if (keyPressed) {
        const dist = Math.hypot(e.x - startX, e.y - startY);
        if (dist === 0) { startX = e.x; startY = e.y; onRightDown(e.x, e.y); }
        else onMove(e.x, e.y);
      }
    });
  } else {
    // Modo mouse: botão do mouse pressionado + arrasto = gesto
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
  }
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
