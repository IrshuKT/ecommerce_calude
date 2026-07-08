const { app, BrowserWindow, Tray, Menu, shell } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

// ---- CONFIG ----
const BACKEND_PORT = 8000;
const FRONTEND_PORT = 3000;
const isDev = !app.isPackaged;

// In dev, run straight from your repo folders. In prod, resources are copied
// next to the installed app (see extraResources in package.json).
const resourcesPath = isDev
  ? path.join(__dirname, '..')          // repo root when running `npm start` from desktop-launcher/
  : process.resourcesPath;

let backendProcess = null;
let frontendProcess = null;
let tray = null;
let mainWindow = null;

function startBackend() {
  if (isDev) {
    // Dev mode: run the FastAPI app directly with uvicorn from backend/
    backendProcess = spawn('python', ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', String(BACKEND_PORT)], {
      cwd: path.join(resourcesPath, 'backend'),
      shell: true
    });
  } else {
    // Prod mode: run the PyInstaller-built exe
    const backendExe = path.join(resourcesPath, 'backend', 'backend.exe');
    backendProcess = spawn(backendExe, [], { cwd: path.join(resourcesPath, 'backend') });
  }
  backendProcess.stdout?.on('data', (d) => console.log(`[backend] ${d}`));
  backendProcess.stderr?.on('data', (d) => console.error(`[backend] ${d}`));
}

function startFrontend() {
  if (isDev) {
    // Dev mode: run next start (assumes you've already run `next build`)
    frontendProcess = spawn('npm', ['run', 'start', '--', '-p', String(FRONTEND_PORT)], {
      cwd: path.join(resourcesPath, 'frontend'),
      env: { ...process.env, HOSTNAME: '127.0.0.1' },
      shell: true
    });
  } else {
    // Prod mode: run the standalone server.js with the bundled portable Node
    const nodeExe = path.join(resourcesPath, 'node', 'node.exe');
    const serverJs = path.join(resourcesPath, 'frontend', 'server.js');
    frontendProcess = spawn(nodeExe, [serverJs], {
      cwd: path.join(resourcesPath, 'frontend'),
      env: { ...process.env, PORT: String(FRONTEND_PORT), HOSTNAME: '127.0.0.1' }
    });
  }
  frontendProcess.stdout?.on('data', (d) => console.log(`[frontend] ${d}`));
  frontendProcess.stderr?.on('data', (d) => console.error(`[frontend] ${d}`));
}

// Poll a local port until it responds, then resolve
function waitForPort(port, timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const req = http.get({ host: '127.0.0.1', port, timeout: 1500 }, (res) => {
        res.destroy();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) reject(new Error(`Timed out waiting for port ${port}`));
        else setTimeout(tryOnce, 500);
      });
    };
    tryOnce();
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    icon: path.join(__dirname, 'build', 'icon.ico')
  });
  mainWindow.loadURL(`http://localhost:${FRONTEND_PORT}`);
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('close', (e) => {
    // Minimize to tray instead of fully quitting
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  const iconPath = path.join(__dirname, 'build', 'icon.ico');
  try {
    tray = new Tray(iconPath);
  } catch (err) {
    console.error(`Could not load tray icon at ${iconPath}. Skipping tray. Error:`, err.message);
    return;
  }
  const menu = Menu.buildFromTemplate([
    { label: 'Open App', click: () => mainWindow.show() },
    { label: 'Open in Browser', click: () => shell.openExternal(`http://localhost:${FRONTEND_PORT}`) },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } }
  ]);
  tray.setToolTip('Ecommerce Calude');
  tray.setContextMenu(menu);
  tray.on('double-click', () => mainWindow.show());
}

app.whenReady().then(async () => {
  // Auto-start on Windows login
  app.setLoginItemSettings({ openAtLogin: true, openAsHidden: false });

  startBackend();
  startFrontend();

  try {
    await Promise.all([waitForPort(BACKEND_PORT), waitForPort(FRONTEND_PORT)]);
  } catch (err) {
    console.error('Services failed to start in time:', err);
  }

  createWindow();
  createTray();
});

app.on('window-all-closed', (e) => {
  // Keep running in tray even if window closes; only quit via tray menu
  e.preventDefault?.();
});

app.on('before-quit', () => {
  app.isQuitting = true;
  backendProcess?.kill();
  frontendProcess?.kill();
});
