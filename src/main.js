'use strict';
const path = require('node:path');
const { app, BrowserWindow, Tray, Menu, screen, nativeImage, Notification, ipcMain } = require('electron');
const { GestureDetector } = require('./gesture');
const { ContextProbe } = require('./context');
const { menuFor, sliceAt } = require('./menus');
const { perform } = require('./actions');

const SIZE = 360; // lado da janela da roda, em DIP
const RIGHT_BUTTON = 2; // uiohook: 1 esquerdo, 2 direito, 3 meio

let overlay = null;
let tray = null;
let hook = null;
let enabled = true;
let session = null; // { ctx, slices, center(DIP), highlighted }

const gesture = new GestureDetector();
const probe = new ContextProbe();

// uiohook entrega pixels físicos; Electron trabalha em DIP.
const toDip = (p) => (process.platform === 'win32' ? screen.screenToDipPoint(p) : p);

function notify(body) {
  if (Notification.isSupported()) new Notification({ title: 'RadialFlow', body }).show();
}

function createOverlay() {
  overlay = new BrowserWindow({
    width: SIZE, height: SIZE, show: false, frame: false, transparent: true,
    resizable: false, skipTaskbar: true, alwaysOnTop: true, focusable: false,
    hasShadow: false, webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true }
  });
  overlay.setAlwaysOnTop(true, 'screen-saver');
  overlay.loadFile(path.join(__dirname, 'overlay', 'index.html'));
  // Nada de menu de contexto nativo: o mouseup do botão direito cai aqui e é engolido.
  overlay.webContents.on('context-menu', (e) => e.preventDefault());
}

function hide() {
  session = null;
  if (overlay && overlay.isVisible()) overlay.hide();
}

gesture.on('trigger', async ({ origin }) => {
  if (!enabled) return;
  const token = {};
  session = token;
  const ctx = await probe.detect(origin.x, origin.y);
  if (session !== token) return; // usuário já soltou o botão
  const slices = menuFor(ctx.kind);
  const center = toDip({ x: origin.x, y: origin.y });
  session = { ctx, slices, center, highlighted: -1 };
  overlay.setBounds({
    x: Math.round(center.x - SIZE / 2), y: Math.round(center.y - SIZE / 2), width: SIZE, height: SIZE
  });
  overlay.webContents.send('show', { slices, kind: ctx.kind });
  overlay.showInactive();
});

gesture.on('move', ({ x, y }) => {
  if (!session || !session.slices) return;
  const p = toDip({ x, y });
  const idx = sliceAt(p.x - session.center.x, p.y - session.center.y, session.slices.length);
  if (idx !== session.highlighted) {
    session.highlighted = idx;
    overlay.webContents.send('highlight', idx);
  }
});

gesture.on('release', async () => {
  const s = session;
  hide();
  if (!s || !s.slices || s.highlighted < 0) return;
  const slice = s.slices[s.highlighted];
  try {
    await perform(slice.id, s.ctx);
  } catch (err) {
    console.error('[ação]', slice.id, err.message);
    notify(`Falhou: ${slice.label} — ${err.message.split('\n')[0]}`);
  }
});

function startHook() {
  let mod;
  try {
    mod = require('uiohook-napi');
  } catch (err) {
    console.error('uiohook-napi indisponível (rode no Windows e execute "npm install"):', err.message);
    return;
  }
  hook = mod.uIOhook;
  hook.on('mousedown', (e) => { if (e.button === RIGHT_BUTTON) gesture.onRightDown(e.x, e.y); });
  hook.on('mousemove', (e) => gesture.onMove(e.x, e.y));
  hook.on('mouseup', (e) => { if (e.button === RIGHT_BUTTON) gesture.onRightUp(e.x, e.y); });
  hook.start();
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, '..', 'assets', 'icon.png'));
  tray = new Tray(icon);
  tray.setToolTip('RadialFlow');
  const rebuild = () => tray.setContextMenu(Menu.buildFromTemplate([
    { label: enabled ? 'Desativar' : 'Ativar', click: () => { enabled = !enabled; rebuild(); } },
    {
      label: 'Iniciar com o Windows', type: 'checkbox',
      checked: app.getLoginItemSettings().openAtLogin,
      click: (i) => app.setLoginItemSettings({ openAtLogin: i.checked })
    },
    { type: 'separator' },
    { label: 'Sair', click: () => app.quit() }
  ]));
  rebuild();
}

if (!app.requestSingleInstanceLock()) app.quit();

app.whenReady().then(() => {
  createOverlay();
  createTray();
  probe.start();
  startHook();
  notify('Ativo. Segure o botão direito e arraste um pouco.');
});

// App de bandeja: não encerra quando não há janelas visíveis.
app.on('window-all-closed', (e) => e.preventDefault());
app.on('before-quit', () => { probe.stop(); if (hook) hook.stop(); });
ipcMain.on('noop', () => {});
