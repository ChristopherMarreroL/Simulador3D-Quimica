// Experimenta 3D · desktop shell. Loads the Vite build (or the dev server) in a secure Chromium window.
const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('node:path');

// Prefer the discrete GPU on dual-GPU laptops and avoid falling back to software WebGL.
app.commandLine.appendSwitch('force_high_performance_gpu');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.setAppUserModelId('com.experimenta3d.lab');

// `npm run desktop:dev` passes --dev-url so the window follows the Vite dev server with hot reload.
const devUrl = (process.argv.find(a => a.startsWith('--dev-url=')) || '').slice('--dev-url='.length) || process.env.EXPERIMENTA_DEV_URL || '';

function createWindow() {
  const win = new BrowserWindow({
    width: 1600, height: 900, minWidth: 1024, minHeight: 640,
    title: 'Experimenta 3D', backgroundColor: '#dfe9ec', show: false, autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false, spellcheck: false },
  });
  Menu.setApplicationMenu(null);
  win.once('ready-to-show', () => { win.maximize(); win.show(); });
  // F11 toggles full screen; external links open in the system browser, never inside the app.
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); event.preventDefault(); }
  });
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (event, url) => { if (!url.startsWith('file:') && !(devUrl && url.startsWith(devUrl))) event.preventDefault(); });
  if (devUrl) win.loadURL(devUrl);
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
