'use strict';
// Utilidades compartilhadas entre plataformas. Comandos externos sempre via
// execFile com lista de argumentos (sem shell, sem montar string de comando).

const { execFile, spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const { clipboard, shell } = require('electron');

function scriptsDir() {
  return process.resourcesPath && !process.defaultApp
    ? path.join(process.resourcesPath, 'scripts')
    : path.join(__dirname, '..', '..', 'scripts');
}

// Processo persistente que responde uma linha JSON para cada linha "x y" recebida.
// Mantido vivo para evitar o custo de iniciar o interpretador a cada gesto.
class LineProbe {
  constructor(cmd, args, timeoutMs = 700) {
    this.cmd = cmd;
    this.args = args;
    this.timeoutMs = timeoutMs;
    this.proc = null;
    this.queue = [];
    this.stopped = false;
  }

  start() {
    this.stopped = false;
    this.proc = spawn(this.cmd, this.args, { windowsHide: true });
    this.proc.on('error', (err) => console.error(`[sonda] não iniciou ${this.cmd}:`, err.message));
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

  stop() {
    this.stopped = true;
    if (this.proc) this.proc.kill();
  }

  ask(x, y) {
    if (!this.proc || !this.proc.stdin.writable) return Promise.resolve({ kind: 'unknown' });
    return new Promise((resolve) => {
      const entry = { resolve, timer: null };
      entry.timer = setTimeout(() => {
        entry.resolve = () => {}; // a resposta tardia ainda será consumida da fila
        resolve({ kind: 'unknown', timeout: true });
      }, this.timeoutMs);
      this.queue.push(entry);
      this.proc.stdin.write(`${Math.round(x)} ${Math.round(y)}\n`);
    });
  }
}

function run(cmd, args, { timeout = 120000, cwd } = {}) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout, cwd, windowsHide: true, maxBuffer: 4 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        if (err.code === 'ENOENT') return reject(new Error(`"${cmd}" não está instalado`));
        return reject(new Error((stderr || err.message).trim()));
      }
      resolve(stdout);
    });
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Copia a seleção do app em foco com o atalho dado e devolve o texto,
// restaurando o conteúdo anterior da área de transferência.
async function copySelection(sendCopy) {
  const previous = clipboard.readText();
  clipboard.clear();
  await sendCopy();
  await sleep(200);
  const text = clipboard.readText();
  const formats = clipboard.availableFormats();
  const uris = formats.includes('text/uri-list') ? clipboard.read('text/uri-list') : '';
  const gnome = formats.includes('x-special/gnome-copied-files')
    ? clipboard.readBuffer('x-special/gnome-copied-files').toString('utf8') : '';
  if (previous) clipboard.writeText(previous);
  return { text, uris: `${uris}\n${gnome}\n${text}` };
}

// Extrai caminhos locais de uma lista de URIs file:// ou caminhos absolutos.
function parsePaths(blob) {
  const out = new Set();
  for (const raw of blob.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith('file://')) {
      try { out.add(decodeURIComponent(new URL(line).pathname)); } catch { /* ignora */ }
    } else if (line.startsWith('/') && fs.existsSync(line)) {
      out.add(line);
    }
  }
  return [...out];
}

async function openTranslate(text) {
  const t = text.trim();
  if (!t) return;
  // O texto vai para o Google Tradutor no navegador (ação explícita do usuário).
  await shell.openExternal('https://translate.google.com/?sl=auto&tl=pt&op=translate&text=' +
    encodeURIComponent(t.slice(0, 4000)));
}

// Nome livre: "foo.zip", "foo (1).zip", ...
function freeName(file) {
  if (!fs.existsSync(file)) return file;
  const { dir, name, ext } = path.parse(file);
  for (let i = 1; ; i++) {
    const candidate = path.join(dir, `${name} (${i})${ext}`);
    if (!fs.existsSync(candidate)) return candidate;
  }
}

function zipTarget(paths) {
  if (paths.length === 1) {
    const { dir, name } = path.parse(paths[0]);
    return freeName(path.join(dir, `${name}.zip`));
  }
  return freeName(path.join(path.dirname(paths[0]), 'Arquivos.zip'));
}

// Compactar/extrair com o módulo zipfile do Python (presente em Linux e macOS).
async function zipWithPython(paths) {
  const dst = zipTarget(paths);
  await run('python3', ['-m', 'zipfile', '-c', dst, ...paths]);
  return dst;
}

async function unzipWithPython(paths) {
  for (const f of paths) {
    const { dir, name } = path.parse(f);
    await run('python3', ['-m', 'zipfile', '-e', f, freeName(path.join(dir, name))]);
  }
}

function withExt(file, ext) {
  const { dir, name } = path.parse(file);
  return freeName(path.join(dir, `${name}${ext}`));
}

module.exports = {
  scriptsDir, LineProbe, run, sleep, copySelection, parsePaths, openTranslate, zipWithPython, unzipWithPython, withExt, zipTarget
};
