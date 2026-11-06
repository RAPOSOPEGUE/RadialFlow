'use strict';
// Fatias da roda por contexto. "id" é a chave usada em actions.js.

const MENUS = {
  file: [
    { id: 'zip', label: 'Compactar', icon: '🗜️' },
    { id: 'unzip', label: 'Extrair', icon: '📂' },
    { id: 'toPng', label: 'Para PNG', icon: '🖼️' },
    { id: 'toJpg', label: 'Para JPG', icon: '📷' },
    { id: 'copyPath', label: 'Copiar caminho', icon: '📋' }
  ],
  titlebar: [
    { id: 'snapLeft', label: 'Esquerda', icon: '◧' },
    { id: 'maximize', label: 'Maximizar', icon: '⬜' },
    { id: 'snapRight', label: 'Direita', icon: '◨' },
    { id: 'minimize', label: 'Minimizar', icon: '▁' }
  ],
  text: [
    { id: 'paste', label: 'Colar', icon: '📋' },
    { id: 'pastePlain', label: 'Colar simples', icon: '📝' },
    { id: 'translate', label: 'Traduzir', icon: '🌐' },
    { id: 'selectAll', label: 'Selecionar tudo', icon: '▤' }
  ],
  // GNOME Wayland sem contexto definido: a roda abre por atalho e age na janela ativa.
  general: [
    { id: 'snapLeft', label: 'Esquerda', icon: '◧' },
    { id: 'maximize', label: 'Maximizar', icon: '⬜' },
    { id: 'snapRight', label: 'Direita', icon: '◨' },
    { id: 'minimize', label: 'Minimizar', icon: '▁' },
    { id: 'screenshot', label: 'Recorte de tela', icon: '✂️' },
    { id: 'taskView', label: 'Visão geral', icon: '🗂️' }
  ],
  unknown: [
    { id: 'screenshot', label: 'Recorte de tela', icon: '✂️' },
    { id: 'showDesktop', label: 'Área de trabalho', icon: '🖥️' },
    { id: 'taskView', label: 'Visão de tarefas', icon: '🗂️' }
  ]
};

function menuFor(kind) {
  return MENUS[kind] || MENUS.unknown;
}

// Fatia 0 fica no topo, sentido horário. Retorna -1 se o cursor está no centro (cancelar).
function sliceAt(dx, dy, count, deadZone = 25) {
  if (Math.hypot(dx, dy) < deadZone) return -1;
  const fromTop = (Math.atan2(dy, dx) + Math.PI / 2 + 2 * Math.PI) % (2 * Math.PI);
  const step = (2 * Math.PI) / count;
  return Math.floor(((fromTop + step / 2) % (2 * Math.PI)) / step);
}

module.exports = { MENUS, menuFor, sliceAt };
