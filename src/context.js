'use strict';
// Ponte com a sonda PowerShell persistente: envia "x y" (pixels físicos), recebe JSON.

const { spawn } = require('node:child_process');
const path = require('node:path');
const readline = require('node:readline');

const TIMEOUT_MS = 700;

function scriptsDir() {
  return process.resourcesPath && !process.defaultApp
    ? path.join(process.resourcesPath, 'scripts')
    : path.join(__dirname, '..', 'scripts');
}

class ContextProbe {
  constructor() {
    this.queue = [];
    this.proc = null;
    this.stopped = false;
  }

  start() {
    if (process.platform !== 'win32') return; // fora do Windows: modo simulado
    this.proc = spawn('powershell.exe', [
      '-NoProfile', '-NoLogo', '-ExecutionPolicy', 'Bypass',
      '-File', path.join(scriptsDir(), 'context-probe.ps1')
    ], { windowsHide: true });

    readline.createInterface({ input: this.proc.stdout }).on('line', (line) => {
      const pending = this.queue.shift();
      if (!pending) return;
      clearTimeout(pending.timer);
      try { pending.resolve(JSON.parse(line)); } catch { pending.resolve({ kind: 'unknown' }); }
    });
    this.proc.stderr.on('data', (d) => console.error('[sonda]', d.toString().trim()));
    this.proc.on('exit', () => {
      this.queue.splice(0).forEach((p) => { clearTimeout(p.timer); p.resolve({ kind: 'unknown' }); });
      this.proc = null;
      if (!this.stopped) setTimeout(() => this.start(), 1000);
    });
  }

  detect(x, y) {
    if (!this.proc) {
      return Promise.resolve({ kind: process.env.RADIALFLOW_FAKE_CONTEXT || 'unknown', paths: [], hwnd: 0 });
    }
    return new Promise((resolve) => {
      const entry = { resolve, timer: null };
      entry.timer = setTimeout(() => {
        entry.resolve = () => {}; // a resposta tardia ainda será consumida da fila
        resolve({ kind: 'unknown', timeout: true });
      }, TIMEOUT_MS);
      this.queue.push(entry);
      this.proc.stdin.write(`${Math.round(x)} ${Math.round(y)}\n`);
    });
  }

  stop() {
    this.stopped = true;
    if (this.proc) this.proc.kill();
  }
}

module.exports = { ContextProbe, scriptsDir };
