'use strict';
const path = require('node:path');
const { app, BrowserWindow, Tray, Menu, screen, nativeImage, Notification, ipcMain } = require('electron');
const { GestureDetector } = require('./gesture');
const { menuFor, sliceAt } = require('./menus');
const { impl } = require('./platform');

const SIZE = 360;
let overlay = null;
let tray = null;
let enabled = true;
let session = null;
let platform = null;

const gesture = new GestureDetector();
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
  overlay.webContents.on('context-menu', (e) => e.preventDefault());
}

function hide() {
  session = null;
  if (overlay && overlay.isVisible()) overlay.hide();
}

gesture.on('trigger', async ({ origin }) => {
  if (!enabled || !platform) return;
  const token = {};
  session = token;
  const ctx = await platform.detectContext(origin.x, origin.y);
  if (session !== token) return;
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
  if (!s || !s.slices || s.highlighted < 0 || !platform) return;
  const slice = s.slices[s.highlighted];
  try {
    await platform.performAction(slice.id, s.ctx);
  } catch (err) {
    console.error('[ação]', slice.id, err.message);
    notify(`Falhou: ${slice.label} — ${err.message.split('\n')[0]}`);
  }
});

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, '..', 'assets', 'icon.png'));
  tray = new Tray(icon);
  tray.setToolTip('RadialFlow');
  const rebuild = () => tray.setContextMenu(Menu.buildFromTemplate([
    { label: enabled ? 'Desativar' : 'Ativar', click: () => { enabled = !enabled; rebuild(); } },
    {
      label: 'Iniciar com o ' + (process.platform === 'win32' ? 'Windows' : 'sistema'),
      type: 'checkbox',
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
  try {
    platform = impl();
    createOverlay();
    createTray();
    platform.startHooks(
      (x, y) => gesture.onRightDown(x, y),
      (x, y) => gesture.onMove(x, y),
      (x, y) => gesture.onRightUp(x, y)
    );
    notify('Ativo. Segure o botão direito e arraste um pouco.');
  } catch (err) {
    console.error('[main]', err.message);
    notify(`Erro: ${err.message}`);
  }
});

app.on('window-all-closed', (e) => e.preventDefault());
app.on('before-quit', () => { if (platform) platform.stopHooks(); });
ipcMain.on('noop', () => {});
