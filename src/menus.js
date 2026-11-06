'use strict';
// Menu de arquivo: compactar, extrair, converter.

const MENU = [
  { id: 'toPdf', label: 'Para PDF', icon: '📄' },
  { id: 'zip', label: 'Compactar', icon: '🗜️' },
  { id: 'unzip', label: 'Extrair', icon: '📂' },
  { id: 'toPng', label: 'Para PNG', icon: '🖼️' },
  { id: 'toJpg', label: 'Para JPG', icon: '📷' },
  { id: 'copyPath', label: 'Copiar caminho', icon: '📋' }
];

function sliceAt(dx, dy, count, deadZone = 25) {
  if (Math.hypot(dx, dy) < deadZone) return -1;
  const fromTop = (Math.atan2(dy, dx) + Math.PI / 2 + 2 * Math.PI) % (2 * Math.PI);
  const step = (2 * Math.PI) / count;
  return Math.floor(((fromTop + step / 2) % (2 * Math.PI)) / step);
}

module.exports = { MENU, sliceAt };
