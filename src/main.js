'use strict';
const path = require('node:path');
const {
  app, BrowserWindow, Tray, Menu, screen, nativeImage, Notification, systemPreferences
} = require('electron');
const { GestureDetector } = require('./gesture');
const { MENU, sliceAt } = require('./menus');
const hooks = require('./hooks');
const { toPdf } = require('./pdf');
const { impl } = require('./platform');

// Linux: roda o Electron via X11 — o uiohook só enxerga eventos X11 e só no X11
// dá para posicionar a roda sob o cursor.
if (process.platform === 'linux') app.commandLine.appendSwitch('ozone-platform', 'x11');

const SIZE = 360; // lado da janela da roda, em DIP
const DEBUG = !!process.env.RADIALFLOW_DEBUG;
const FAKE_CONTEXT = process.env.RADIALFLOW_FAKE_CONTEXT; // força "file" e só registra a ação escolhida

let overlay = null;
let tray = null;
let enabled = true;
let session = null; // { ctx, center(DIP), highlighted }
let platform = null;

const gesture = new GestureDetector();

// No Windows o uiohook entrega pixels físicos; Electron trabalha em DIP.
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
  overlay.setVisibleOnAllWorkspaces(true);
  overlay.loadFile(path.join(__dirname, 'overlay', 'index.html'));
  overlay.webContents.on('context-menu', (e) => e.preventDefault());
}

function hide() {
  session = null;
  if (overlay && overlay.isVisible()) overlay.hide();
}

gesture.on('trigger', async ({ origin }) => {
  if (DEBUG) console.log('[gesto] disparou em', origin.x, origin.y);
  if (!enabled) return;
  const token = {};
  session = token;
  if (platform.dismissNativeMenu) {
    try { hooks.keys('Escape'); } catch { /* sem teclado sintético: o menu nativo fica aberto */ }
  }
  const ctx = FAKE_CONTEXT
    ? { kind: 'file', paths: [] }
    : await platform.detectContext(origin.x, origin.y);
  if (session !== token) return; // usuário soltou o botão antes da detecção terminar
  if (DEBUG) console.log('[contexto]', JSON.stringify(ctx));
  if (ctx.kind !== 'file') { session = null; return; } // a roda é só para arquivos

  const center = toDip({ x: origin.x, y: origin.y });
  session = { ctx, center, highlighted: -1 };
  overlay.setBounds({
    x: Math.round(center.x - SIZE / 2), y: Math.round(center.y - SIZE / 2), width: SIZE, height: SIZE
  });
  overlay.webContents.send('show', { slices: MENU });
  overlay.showInactive();
});

gesture.on('move', ({ x, y }) => {
  if (!session || !session.center) return;
  const p = toDip({ x, y });
  const idx = sliceAt(p.x - session.center.x, p.y - session.center.y, MENU.length);
  if (idx !== session.highlighted) {
    session.highlighted = idx;
    overlay.webContents.send('highlight', idx);
  }
});

gesture.on('release', async () => {
  const s = session;
  hide();
  if (!s || !s.center || s.highlighted < 0) return;
  const slice = MENU[s.highlighted];
  if (FAKE_CONTEXT) {
    console.log('[simulado] ação:', slice.id);
    return;
  }
  try {
    if (slice.id === 'toPdf') await toPdf(s.ctx.paths);
    else await platform.performAction(slice.id, s.ctx);
  } catch (err) {
    console.error('[ação]', slice.id, err.message);
    notify(`Falhou: ${slice.label} — ${err.message.split('\n')[0]}`);
  }
});

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, '..', 'assets', 'icon.png'));
  tray = new Tray(process.platform === 'darwin' ? icon.resize({ width: 18, height: 18 }) : icon);
  tray.setToolTip('RadialFlow');
  const rebuild = () => tray.setContextMenu(Menu.buildFromTemplate([
    { label: enabled ? 'Desativar' : 'Ativar', click: () => { enabled = !enabled; rebuild(); } },
    {
      // No Linux o Electron não suporta abrir no login; o README explica o .desktop de autostart.
      label: 'Iniciar com o sistema', type: 'checkbox', visible: process.platform !== 'linux',
      checked: app.getLoginItemSettings().openAtLogin,
      click: (i) => app.setLoginItemSettings({ openAtLogin: i.checked })
    },
    { type: 'separator' },
    { label: 'Sair', click: () => app.quit() }
  ]));
  rebuild();
}

function fail(message) {
  console.error('[RadialFlow]', message);
  notify(message);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.whenReady().then(start);
}

function start() {
  if (process.platform === 'darwin') app.dock.hide();
  if (process.platform === 'linux' && process.env.XDG_SESSION_TYPE === 'wayland') {
    console.warn('[RadialFlow] Sessão Wayland: o gesto não funciona. Entre em "GNOME em Xorg" (veja o README).');
  }
  platform = impl();
  createOverlay();
  createTray();

  if (process.platform === 'darwin' && !systemPreferences.isTrustedAccessibilityClient(true)) {
    fail('Dê permissão de Acessibilidade ao RadialFlow (Ajustes do Sistema → Privacidade e Segurança → Acessibilidade) e abra-o de novo.');
    return;
  }
  if (!FAKE_CONTEXT) platform.start();

  try {
    hooks.start({
      onRightDown: (x, y) => gesture.onRightDown(x, y),
      onMove: (x, y) => gesture.onMove(x, y),
      onRightUp: (x, y) => gesture.onRightUp(x, y)
    });
  } catch (err) {
    fail(err.message);
    return;
  }
  notify('Ativo. Segure o botão direito sobre um arquivo e arraste um pouco.');
}

// Encerramento limpo ao receber sinal (Ctrl+C no terminal, systemd, kill).
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => app.quit());

// App de bandeja: não encerra quando não há janelas visíveis.
app.on('window-all-closed', (e) => e.preventDefault());
app.on('before-quit', () => {
  hooks.stop();
  if (platform) platform.stop();
});
