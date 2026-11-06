'use strict';
const wheel = document.getElementById('wheel');
const RADIUS = 125;
const CENTER = 180;
let nodes = [];

window.radial.onShow(({ slices }) => {
  nodes.forEach((n) => n.remove());
  nodes = slices.map((s, i) => {
    const angle = (2 * Math.PI * i) / slices.length - Math.PI / 2; // fatia 0 no topo
    const el = document.createElement('div');
    el.className = 'slice';
    el.style.left = `${CENTER + RADIUS * Math.cos(angle)}px`;
    el.style.top = `${CENTER + RADIUS * Math.sin(angle)}px`;
    const icon = document.createElement('div');
    icon.className = 'icon';
    icon.textContent = s.icon;
    const label = document.createElement('div');
    label.textContent = s.label;
    el.append(icon, label);
    wheel.appendChild(el);
    return el;
  });
});

window.radial.onHighlight((idx) => nodes.forEach((n, i) => n.classList.toggle('on', i === idx)));
