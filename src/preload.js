'use strict';
const { contextBridge, ipcRenderer } = require('electron');

// O processo principal acompanha o mouse e só manda mostrar a roda e destacar fatias.
contextBridge.exposeInMainWorld('radial', {
  onShow: (cb) => ipcRenderer.on('show', (_e, data) => cb(data)),
  onHighlight: (cb) => ipcRenderer.on('highlight', (_e, idx) => cb(idx))
});
