'use strict';
// Detector de gesto puro (sem dependências nativas), fácil de testar.
// Botão direito pressionado + arrasto entre minDistance e maxDistance dentro
// de maxDurationMs => emite "trigger" uma vez. Ao soltar, emite "release".

const { EventEmitter } = require('node:events');

const DEFAULTS = { minDistance: 12, maxDistance: 400, maxDurationMs: 800 };

class GestureDetector extends EventEmitter {
  constructor(options = {}) {
    super();
    this.opts = { ...DEFAULTS, ...options };
    this.reset();
  }

  reset() {
    this.pressed = false;
    this.fired = false;
    this.start = null;
  }

  onRightDown(x, y, t = Date.now()) {
    this.pressed = true;
    this.fired = false;
    this.start = { x, y, t };
  }

  onMove(x, y, t = Date.now()) {
    if (!this.pressed) return;
    if (this.fired) {
      this.emit('move', { x, y });
      return;
    }
    const { minDistance, maxDistance, maxDurationMs } = this.opts;
    if (t - this.start.t > maxDurationMs) return;
    const dist = Math.hypot(x - this.start.x, y - this.start.y);
    if (dist >= minDistance && dist <= maxDistance) {
      this.fired = true;
      this.emit('trigger', { origin: { x: this.start.x, y: this.start.y } });
    }
  }

  // Retorna true se o gesto foi disparado (quem chama deve suprimir o menu de contexto).
  onRightUp(x, y) {
    const wasGesture = this.fired;
    const origin = this.start;
    this.reset();
    if (wasGesture) this.emit('release', { x, y, origin: { x: origin.x, y: origin.y } });
    return wasGesture;
  }
}

module.exports = { GestureDetector, DEFAULTS };
