'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('radial', {
  onShow: (cb) => ipcRenderer.on('show', (_e, data) => cb(data)),
  onHighlight: (cb) => ipcRenderer.on('highlight', (_e, idx) => cb(idx))
});
