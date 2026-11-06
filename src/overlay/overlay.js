'use strict';
const wheel = document.getElementById('wheel');
const center = document.getElementById('center');
const RADIUS = 125;
const HALF = 180; // metade do lado da roda
let nodes = [];
let pick = null; // modo atalho: { count, cx, cy, moved, idx }

// Mesma regra de src/menus.js: fatia 0 no topo, sentido horário, -1 no centro.
function sliceAt(dx, dy, count, deadZone = 25) {
  if (Math.hypot(dx, dy) < deadZone) return -1;
  const fromTop = (Math.atan2(dy, dx) + Math.PI / 2 + 2 * Math.PI) % (2 * Math.PI);
  const step = (2 * Math.PI) / count;
  return Math.floor(((fromTop + step / 2) % (2 * Math.PI)) / step);
}

function build(slices, numbered) {
  nodes.forEach((n) => n.remove());
  nodes = slices.map((s, i) => {
    const angle = (2 * Math.PI * i) / slices.length - Math.PI / 2;
    const el = document.createElement('div');
    el.className = 'slice';
    el.style.left = `${HALF + RADIUS * Math.cos(angle)}px`;
    el.style.top = `${HALF + RADIUS * Math.sin(angle)}px`;
    const icon = document.createElement('div');
    icon.className = 'icon';
    icon.textContent = s.icon;
    const label = document.createElement('div');
    label.textContent = s.label;
    el.append(icon, label);
    if (numbered) {
      const num = document.createElement('div');
      num.className = 'num';
      num.textContent = String(i + 1);
      el.append(num);
    }
    wheel.appendChild(el);
    return el;
  });
}

function highlight(idx) {
  nodes.forEach((n, i) => n.classList.toggle('on', i === idx));
}

function placeAt(x, y) {
  wheel.style.left = `${x - HALF}px`;
  wheel.style.top = `${y - HALF}px`;
}

// ---- Modo gesto (janela do tamanho da roda, o processo principal guia) ----
window.radial.onShow(({ slices }) => {
  pick = null;
  center.textContent = 'solte p/ cancelar';
  build(slices, false);
  placeAt(HALF, HALF);
  wheel.hidden = false;
});
window.radial.onHighlight(highlight);

// ---- Modo atalho (Wayland: janela em tela cheia, a página guia) ----

window.radial.onPick(({ slices, cursor }) => {
  center.textContent = 'Esc cancela';
  build(slices, true);
  pick = { count: slices.length, cx: cursor.x, cy: cursor.y, moved: false, idx: -1 };
  placeAt(cursor.x, cursor.y);
  highlight(-1);
  wheel.hidden = false;
});

document.addEventListener('mousemove', (e) => {
  if (!pick) return;
  // No Wayland a posição inicial do cursor pode vir desatualizada: no primeiro
  // movimento, se o cursor estiver longe da roda, ela vai até ele.
  if (!pick.moved) {
    pick.moved = true;
    if (Math.hypot(e.clientX - pick.cx, e.clientY - pick.cy) > HALF) {
      pick.cx = e.clientX;
      pick.cy = e.clientY;
      placeAt(pick.cx, pick.cy);
    }
  }
  pick.idx = sliceAt(e.clientX - pick.cx, e.clientY - pick.cy, pick.count);
  highlight(pick.idx);
});

function finish(idx) {
  if (!pick) return;
  pick = null;
  wheel.hidden = true;
  if (idx >= 0) window.radial.pick(idx);
  else window.radial.cancel();
}

document.addEventListener('mouseup', (e) => {
  if (pick && e.button === 0) finish(pick.idx);
});
document.addEventListener('keydown', (e) => {
  if (!pick) return;
  if (e.key === 'Escape') finish(-1);
  const n = Number(e.key);
  if (n >= 1 && n <= pick.count) finish(n - 1);
});
document.addEventListener('contextmenu', (e) => e.preventDefault());
