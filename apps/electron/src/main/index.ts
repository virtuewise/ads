import fs from 'node:fs';
import path from 'node:path';
import { app, BrowserWindow } from 'electron';
import './ipc';

/** Arguments that are not switches, and end in a project extension. */
function projectFromArgv(argv: string[]): string | null {
  for (const arg of argv.slice(1)) {
    if (arg.startsWith('-')) continue;
    if (/\.vfxproj(\.bin)?$/i.test(arg) && fs.existsSync(arg)) return path.resolve(arg);
  }
  return null;
}

function createWindow() {
  const rootDir = import.meta.dirname as string;

  // `electron .vfxproj` opens that project straight away — the desktop-app
  // behaviour of double-clicking a project file.
  const project = projectFromArgv(process.argv);

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(rootDir, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      additionalArguments: project ? [`--virtue-project=${project}`] : [],
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
