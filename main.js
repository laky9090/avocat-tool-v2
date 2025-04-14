const { app, BrowserWindow } = require('electron');
const path = require('path');
const remoteMain = require('@electron/remote/main');

// Désactiver l'accélération GPU
app.disableHardwareAcceleration();

remoteMain.initialize();

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 800,
    icon: path.join(__dirname, 'icon.ico'),
    autoHideMenuBar: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      webgl: false // Désactiver WebGL
      // Supprimer offscreen: true qui cause l'écran blanc
    },
    // Options de fenêtre
    scrollBounce: false,
    enableLargerThanScreen: false
  });

  // Désactiver le zoom
  win.webContents.setZoomFactor(1);
  win.webContents.setVisualZoomLevelLimits(1, 1);

  win.loadFile('index.html');
  win.maximize();
  remoteMain.enable(win.webContents);
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});