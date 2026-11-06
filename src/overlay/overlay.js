'use strict';
const wheel = document.getElementById('wheel');
const RADIUS = 125;
const HALF = 180; // metade do lado da roda
let nodes = [];

function build(slices) {
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
    wheel.appendChild(el);
    return el;
  });
}

window.radial.onShow(({ slices }) => {
  build(slices);
  wheel.hidden = false;
});
window.radial.onHighlight((idx) => {
  nodes.forEach((n, i) => n.classList.toggle('on', i === idx));
});
document.addEventListener('contextmenu', (e) => e.preventDefault());
