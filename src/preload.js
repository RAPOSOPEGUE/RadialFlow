'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('radial', {
  // Modo gesto: o processo principal acompanha o mouse e só manda destacar fatias.
  onShow: (cb) => ipcRenderer.on('show', (_e, data) => cb(data)),
  onHighlight: (cb) => ipcRenderer.on('highlight', (_e, idx) => cb(idx)),
  // Modo atalho (Wayland): a própria página acompanha o mouse e devolve a escolha.
  onPick: (cb) => ipcRenderer.on('pick', (_e, data) => cb(data)),
  pick: (idx) => ipcRenderer.send('picked', idx),
  cancel: () => ipcRenderer.send('pick-cancel')
});
