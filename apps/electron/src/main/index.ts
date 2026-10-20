import path from 'node:path';
import { app, BrowserWindow } from 'electron';
import './ipc';

function createWindow() {
  const rootDir = import.meta.dirname as string;

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(rootDir, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    win.loadFile(path.join(rootDir, '../renderer/index.html'));
  }
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
