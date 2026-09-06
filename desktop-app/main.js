const { app, BrowserWindow, Menu, ipcMain, screen, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const net = require('net');
const crypto = require('crypto');

// 1. HARDWARE COMPATIBILITY: Enable GPU acceleration for smooth rendering of glassmorphism and animations
// app.disableHardwareAcceleration();

let mainWindow;
let nextProcess;

const isPackaged = app.isPackaged;
const appDataPath = app.getPath('userData');
const dbPath = path.join(appDataPath, 'database.db');
const logPath = path.join(appDataPath, 'debug.log');

// Uploads live beside the database, in userData, NOT in the installed app.
// The default (server/public/uploads) sits inside the installation directory,
// which electron-updater's NSIS installer removes before writing the new
// version - so every auto-update would have destroyed every PDF, proof of work
// and audio file the user had uploaded.
const uploadsPath = path.join(appDataPath, 'uploads');
const jwtSecretPath = path.join(appDataPath, 'jwt-secret');

/**
 * A signing secret that belongs to THIS INSTALL and nothing else.
 *
 * Next copies the project's root .env into .next/standalone/.env, and
 * electron-builder ships that whole directory as plain files under
 * resources/server - outside the asar. The desktop app therefore used to boot
 * with the PRODUCTION JWT_SECRET and Postgres credentials sitting in a
 * readable file on every user's disk, which is enough to forge a session
 * cookie for the live web app or connect straight to its database.
 *
 * The desktop server has no business knowing either: it only ever talks to the
 * local SQLite file. So the .env is now excluded from the package (see
 * extraResources in package.json) and the secret is generated per install and
 * kept in userData, beside the database.
 *
 * Consequence worth knowing: rotating this logs out existing desktop sessions
 * once. That is correct - those sessions were signed with a secret that should
 * never have been on the machine.
 */
function getOrCreateJwtSecret() {
  try {
    if (fs.existsSync(jwtSecretPath)) {
      const existing = fs.readFileSync(jwtSecretPath, 'utf8').trim();
      if (existing.length >= 32) return existing;
    }
  } catch (e) {
    // Unreadable: fall through and mint a new one rather than refuse to boot.
  }

  const secret = crypto.randomBytes(48).toString('base64url');
  try {
    fs.writeFileSync(jwtSecretPath, secret, { mode: 0o600 });
  } catch (e) {
    // Cannot persist it: the app still runs, but sessions will not survive a
    // restart. Better than failing to start.
    log(`WARNING: could not persist the session secret: ${e.message}`);
  }
  return secret;
}

// Standalone Next.js structure: root/server.js, root/.next, root/public, root/node_modules
const rootDir = isPackaged ? process.resourcesPath : path.join(__dirname, '..');
const serverDir = isPackaged ? path.join(rootDir, 'server') : rootDir;
const serverPath = path.join(serverDir, 'server.js');

function log(msg) {
  const timestamp = new Date().toISOString();
  const formatted = `[${timestamp}] ${msg}\n`;
  console.log(msg);
  try { fs.appendFileSync(logPath, formatted); } catch(e) {}
  
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.getURL().startsWith('data:')) {
    mainWindow.webContents.executeJavaScript(`
      (() => {
        try {
          var logEl = document.getElementById('log');
          if (logEl) {
            logEl.innerText += "\\n" + ${JSON.stringify(msg)};
            window.scrollTo(0, document.body.scrollHeight);
          }
        } catch (e) {}
      })();
    `).catch(() => {});
  }
}

// Function to find an available port
function getFreePort(startPort) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(startPort, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on('error', () => {
      resolve(getFreePort(startPort + 1));
    });
  });
}

/**
 * Keep a rolling set of backups of the user's database.
 *
 * Taken BEFORE the server boots, because booting is what applies pending
 * migrations. If a migration ever fails half way, the pre-migration copy is
 * sitting right next to the live file.
 */
function backupDatabase() {
  try {
    if (!fs.existsSync(dbPath)) return;

    const dir = path.join(appDataPath, 'backups');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.copyFileSync(dbPath, path.join(dir, `database-${stamp}.db`));

    // Keep the 10 most recent; old ones are not worth the disk.
    const backups = fs
      .readdirSync(dir)
      .filter((f) => f.startsWith('database-') && f.endsWith('.db'))
      .sort()
      .reverse();
    for (const stale of backups.slice(10)) {
      try { fs.unlinkSync(path.join(dir, stale)); } catch (e) {}
    }
    log(`Backup written (${backups.length + 1} kept).`);
  } catch (err) {
    // A failed backup must not stop the app launching.
    log(`WARNING: could not back up the database: ${err.message}`);
  }
}

async function setupDatabase() {
  log('Initializing system storage...');
  if (!fs.existsSync(appDataPath)) {
    fs.mkdirSync(appDataPath, { recursive: true });
  }

  if (!fs.existsSync(dbPath)) {
    // Start EMPTY and let the migrations build the schema on first boot.
    //
    // This used to copy prisma/dev.db as a template, which shipped whatever
    // schema that file happened to have - it was from the original two-table
    // SQLite era and is years out of date. Migrations are now the only thing
    // that defines the schema, so a fresh install and an upgraded install end
    // up byte-for-byte identical.
    log('No database found. A fresh one will be created by the migrations.');
    fs.writeFileSync(dbPath, '');
  } else {
    backupDatabase();
  }

  process.env.DATABASE_URL = `file:${dbPath}`;
  log(`Database ready at: ${dbPath}`);
}

/**
 * Check GitHub Releases for a newer build.
 *
 * Updates download in the background and are installed when the user agrees to
 * restart - never mid-session, which would kill a focus timer.
 *
 * Only runs in a packaged app: in development there is no update feed and
 * electron-updater throws.
 */
function setupAutoUpdates() {
  if (!isPackaged) {
    log('Dev build: skipping update check.');
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = { info: log, warn: log, error: log, debug: () => {} };

  autoUpdater.on('update-available', (info) => log(`Update available: ${info.version}`));
  autoUpdater.on('update-not-available', () => log('Already up to date.'));
  autoUpdater.on('error', (err) => log(`Update check failed: ${err && err.message}`));

  autoUpdater.on('update-downloaded', async (info) => {
    log(`Update ${info.version} downloaded.`);
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      buttons: ['Restart now', 'Later'],
      defaultId: 0,
      cancelId: 1,
      title: 'Update ready',
      message: `Study Flow ${info.version} is ready to install.`,
      detail: 'Your work is saved. The app will reopen where you left off.',
    });
    // "Later" still installs on quit, so the update is never lost.
    if (response === 0) autoUpdater.quitAndInstall();
  });

  autoUpdater.checkForUpdates().catch((e) => log(`Update check error: ${e.message}`));
  // And once every six hours for long-running sessions.
  setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, 6 * 60 * 60 * 1000);
}

async function createWindow() {
  Menu.setApplicationMenu(null);
  await setupDatabase();
  let port = 3000;
  
  mainWindow = new BrowserWindow({
    width: 1300,
    height: 900,
    backgroundColor: '#050505',
    show: false,
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    setupAutoUpdates();
  });

  // Capture client-side console messages (errors, warnings, logs)
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    // Only capture logs from the Next.js app to avoid infinite recursion/feedback loops from the loader or Electron internals
    if (!sourceId || !sourceId.startsWith('http://127.0.0.1')) return;
    log(`CLIENT CONSOLE [Level ${level}]: ${message} (at ${sourceId}:${line})`);
  });

  // Handle connection or loading failures by showing our custom error fallback page
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    // Ignore aborted loads (errorCode -3 is triggered when a navigation is cancelled or redirected)
    if (errorCode === -3) return;
    
    // Ignore loader page errors
    if (validatedURL && validatedURL.startsWith('data:')) return;

    log(`CLIENT CONNECTION FAILURE [Code ${errorCode}]: ${errorDescription} (at ${validatedURL})`);
    
    mainWindow.loadFile(path.join(__dirname, 'error.html'), { query: { port: port.toString() } });
  });

  // Loading Screen with verbose diagnostic log
  const loadingHtml = `
    data:text/html,
    <html>
      <body style="background:#050505;color:white;display:flex;flex-direction:column;justify-content:center;align-items:center;height:100vh;margin:0;font-family:sans-serif;text-align:center;overflow:hidden;">
        <div style="max-width:600px;width:90%;">
          <h1 style="margin:0;font-size:4rem;letter-spacing:-0.05em;font-weight:900;italic">STUDY FLOW</h1>
          <p style="color:#444;text-transform:uppercase;letter-spacing:0.4em;font-size:0.8rem;margin-bottom:3rem;font-weight:bold;">Elite Workstation Protocol</p>
          <div style="width:100%;height:4px;background:#111;position:relative;overflow:hidden;margin-bottom:2rem;border-radius:2px;">
            <div style="position:absolute;width:40%;height:100%;background:#3b82f6;animation:load 2s infinite ease-in-out;box-shadow: 0 0 20px #3b82f6;"></div>
          </div>
          <pre id="log" style="text-align:left;font-size:0.7rem;color:#333;background:#030303;padding:1.5rem;border-radius:20px;border:1px solid #111;overflow-y:auto;white-space:pre-wrap;height:180px;font-family:monospace;"></pre>
        </div>
        <style>@keyframes load { 0% { left:-40%; } 100% { left:100%; } }</style>
      </body>
    </html>
  `.trim().replace(/\n/g, '');

  mainWindow.loadURL(loadingHtml);

  log(`Locating free communications channel...`);
  port = await getFreePort(3000);
  const hostname = '127.0.0.1';
  
  log(`Initializing interface on port ${port}...`);
  log(`Host OS: ${process.platform} (${process.arch})`);
  log(`Engine Path: ${process.execPath}`);

  if (isPackaged) {
    if (!fs.existsSync(serverPath)) {
      log(`FATAL: Neural Core missing at ${serverPath}`);
    } else {
      log(`Neural Core localized.`);
    }
  }
  
  log(`Spawning background engine...`);

  nextProcess = spawn(isPackaged ? process.execPath : 'npm.cmd', isPackaged ? [serverPath] : ['run', 'dev', '--', '-p', port], {
    cwd: serverDir,
    env: { 
      ...process.env, 
      NODE_ENV: 'production', 
      PORT: port.toString(),
      HOSTNAME: hostname,
      DATABASE_URL: `file:${dbPath}`,
      UPLOADS_DIR: uploadsPath,
      // Set explicitly so Next's env loader cannot fall back to a bundled
      // .env - it only fills in variables that are not already present.
      JWT_SECRET: getOrCreateJwtSecret(),
      ELECTRON_RUN_AS_NODE: '1',
      NEXT_TELEMETRY_DISABLED: '1'
    },
    shell: !isPackaged
  });

  nextProcess.stdout.on('data', (data) => log(`ENGINE: ${data.toString().trim()}`));
  nextProcess.stderr.on('data', (data) => log(`SYSTEM: ${data.toString().trim()}`));

  const checkServer = () => {
    return new Promise((resolve) => {
      const socket = net.connect({ port, host: hostname }, () => {
        socket.end();
        resolve(true);
      });
      socket.on('error', () => {
        resolve(false);
      });
      socket.setTimeout(1500);
      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });
    });
  };

  const maxAttempts = 60; // 60 seconds for slow HDDs
  let attempts = 0;

  const waitForServer = async () => {
    const isReady = await checkServer();
    if (isReady) {
      log('Engine stabilized. Synchronizing visual layers...');
      
      // We load /login but check for redirect loop
      mainWindow.loadURL(`http://${hostname}:${port}/login`);
      
      mainWindow.webContents.on('did-finish-load', () => {
        // Apply custom desktop styling
        const cssPath = path.join(__dirname, 'desktop.css');
        if (fs.existsSync(cssPath)) {
          const css = fs.readFileSync(cssPath, 'utf8');
          mainWindow.webContents.insertCSS(css);
        }
        
        // Prevent context menu
        mainWindow.webContents.executeJavaScript(`
          window.addEventListener('contextmenu', (e) => e.preventDefault());
        `);
      });
    } else if (attempts < maxAttempts) {
      attempts++;
      if (attempts % 5 === 0) log(`Synchronization attempt ${attempts}...`);
      setTimeout(waitForServer, 1000);
    } else {
      log('CRITICAL: Handshake timeout. System unstable.');
      mainWindow.loadFile(path.join(__dirname, 'error.html'), { query: { port: port.toString() } });
    }
  };

  waitForServer();

  // Debug Console: Ctrl+Shift+D
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.control && input.shift && input.key.toLowerCase() === 'd') {
      mainWindow.webContents.openDevTools();
      event.preventDefault();
    }
  });

  // IPC handlers for widget mode
  let widgetWindow = null;

  ipcMain.on('enter-widget', (event, arg) => {
    if (widgetWindow) return;

    mainWindow.hide();

    // Position the widget window in the bottom-right corner of the screen by default
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
    const widgetWidth = 344;
    const widgetHeight = 208;
    const x = screenWidth - widgetWidth - 24;
    const y = screenHeight - widgetHeight - 24;

    widgetWindow = new BrowserWindow({
      width: widgetWidth,
      height: widgetHeight,
      x: x,
      y: y,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      resizable: true,
      minWidth: 300,
      minHeight: 132,
      maxWidth: 600,
      maxHeight: 300,
      show: false,
      icon: path.join(__dirname, 'icon.ico'),
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
        backgroundThrottling: false
      }
    });

    widgetWindow.once('ready-to-show', () => {
      widgetWindow.show();
    });

    widgetWindow.loadURL(`http://127.0.0.1:${port}/focus/widget?taskId=${arg.taskId}`);

    widgetWindow.on('closed', () => {
      widgetWindow = null;
      // Show main window back if it was hidden
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
  });

  ipcMain.on('exit-widget', () => {
    if (widgetWindow) {
      widgetWindow.close();
      widgetWindow = null;
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (nextProcess) nextProcess.kill();
    if (widgetWindow) {
      widgetWindow.close();
      widgetWindow = null;
    }
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (nextProcess) nextProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});
