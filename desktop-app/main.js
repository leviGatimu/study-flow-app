const { app, BrowserWindow, Menu, ipcMain, screen, dialog, shell, powerMonitor, session } = require('electron');
const { autoUpdater } = require('electron-updater');
const { safeToRestart } = require('./update-policy');
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

// The resource library is the one thing that is deliberately NOT in userData:
// it is a folder the student opens in Explorer, one sub-folder per subject,
// and AppData is where things go to be hidden. Documents\Study Tracker is
// where a person would look. The server creates it on first use.
const libraryPath = path.join(app.getPath('documents'), 'Study Tracker');

/**
 * Resolve a path the renderer asked to open, refusing anything outside the
 * library. The renderer only ever sends paths the server gave it, but the
 * renderer is a web page and this is the boundary where that stops mattering.
 */
function insideLibrary(target) {
  if (typeof target !== 'string' || !target) return null;
  const full = path.resolve(target);
  const root = path.resolve(libraryPath);
  return full === root || full.startsWith(root + path.sep) ? full : null;
}

// Open a library folder in Explorer, or reveal a file inside it.
ipcMain.handle('library:open', async (_event, target) => {
  const full = insideLibrary(target);
  if (!full) return { ok: false, error: 'That path is not inside the library.' };
  if (!fs.existsSync(full)) {
    try {
      fs.mkdirSync(full, { recursive: true });
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }
  const problem = await shell.openPath(full);
  return problem ? { ok: false, error: problem } : { ok: true };
});

ipcMain.handle('library:reveal', (_event, target) => {
  const full = insideLibrary(target);
  if (!full || !fs.existsSync(full)) return { ok: false, error: 'That file is not in the library any more.' };
  shell.showItemInFolder(full);
  return { ok: true };
});

// The window has no Windows title bar; the app header draws its own window
// buttons (components/WindowControls.tsx) and calls these.
ipcMain.on('window:control', (event, action) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  if (action === 'minimize') win.minimize();
  else if (action === 'toggle-maximize') (win.isMaximized() ? win.unmaximize() : win.maximize());
  else if (action === 'close') win.close();
});
ipcMain.handle('window:is-maximized', (event) => BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false);

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
}

const loadingPagePath = path.join(__dirname, 'loading.html');

/** Plain-words progress line on the loading screen (desktop-app/loading.html). */
function showStatus(text) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (!mainWindow.webContents.getURL().startsWith('file:')) return;
  mainWindow.webContents
    .executeJavaScript(`window.setStatus && window.setStatus(${JSON.stringify(text)})`)
    .catch(() => {});
}

// Function to find an available port
/**
 * Is anything already answering on 127.0.0.1:port?
 *
 * A bind test alone is not enough on Windows: binding 127.0.0.1:3000 SUCCEEDS
 * while another process holds 0.0.0.0:3000 (a `next dev` for this very app,
 * a Vite server, anything). The app then "found" port 3000 free, connected to
 * the OTHER server's port, saw it answer, and loaded /login from a stranger -
 * which is where the "Nothing here" first page came from. A connect probe
 * catches whatever a bind test misses.
 */
function portAnswers(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: '127.0.0.1' });
    const done = (answered) => {
      socket.destroy();
      resolve(answered);
    };
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
    socket.setTimeout(400, () => done(false));
  });
}

function canBind(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    // 0.0.0.0, not 127.0.0.1: a wildcard bind is what collides with a dev
    // server holding the port on all interfaces.
    server.listen(port, '0.0.0.0', () => server.close(() => resolve(true)));
  });
}

async function getFreePort(startPort) {
  for (let port = startPort; port < startPort + 50; port++) {
    if (await portAnswers(port)) {
      log(`Port ${port} is already answering; trying the next one.`);
      continue;
    }
    if (await canBind(port)) return port;
  }
  throw new Error(`No free port between ${startPort} and ${startPort + 49}`);
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
 * Everything the app knows about updates, mirrored into the renderer so
 * Settings can both show the state and drive it.
 *
 * `phase` is the single source of truth for the button in Settings:
 *   unsupported - not a packaged build, there is no update feed to talk to
 *   idle        - nothing checked yet this session
 *   checking    - a check is in flight
 *   up-to-date  - the feed says this is the newest build
 *   available   - a newer build exists and the download has started
 *   downloading - bytes are arriving (percent is meaningful)
 *   downloaded  - staged on disk; only a restart is left
 *   error       - the last check or download failed (message says why)
 */
let updateState = {
  phase: 'idle',
  version: null,
  percent: 0,
  message: null,
  currentVersion: app.getVersion(),
  supported: false,
  lastCheckedAt: null,
  autoInstall: readAutoInstall(),
};

/** Whether this person turned auto update on. Off unless they chose it. */
function readAutoInstall() {
  try {
    return JSON.parse(fs.readFileSync(path.join(appDataPath, 'update-settings.json'), 'utf8')).autoInstall === true;
  } catch {
    return false;
  }
}

/** Silent, then reopen: no installer window to click through, and the app comes back by itself. */
function restartIntoUpdate() {
  autoUpdater.quitAndInstall(true, true);
}

const AUTO_RESTART_CHECK_MS = 30_000;
let autoRestartTimer = null;

/** With auto update on, wait for a moment the restart cannot interrupt anything. */
function waitToRestart() {
  if (autoRestartTimer || !updateState.autoInstall || updateState.phase !== 'downloaded') return;
  autoRestartTimer = setInterval(async () => {
    if (!updateState.autoInstall) {
      clearInterval(autoRestartTimer);
      autoRestartTimer = null;
      return;
    }
    let savedFocus = '{unknown';
    try {
      if (mainWindow) savedFocus = await mainWindow.webContents.executeJavaScript("localStorage.getItem('study-flow-focus')");
    } catch (e) {
      log(`Could not read focus state: ${e.message}`);
    }
    if (safeToRestart({ idleSeconds: powerMonitor.getSystemIdleTime(), savedFocus })) {
      clearInterval(autoRestartTimer);
      autoRestartTimer = null;
      log('Auto update: restarting into the new version.');
      restartIntoUpdate();
    }
  }, AUTO_RESTART_CHECK_MS);
}

function setUpdateState(patch) {
  updateState = { ...updateState, ...patch };
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('updates:status', updateState);
    }
  }
}

/**
 * Check GitHub Releases for a newer build.
 *
 * Updates download in the background. They install when the user agrees to
 * restart or, with auto update on, once the app is idle with no focus session
 * running - never mid-session, which would kill a focus timer.
 *
 * Only wired up in a packaged app: in development there is no update feed and
 * electron-updater throws. Settings says so rather than showing a button that
 * cannot work.
 */
function setupAutoUpdates() {
  if (!isPackaged) {
    log('Dev build: skipping update check.');
    setUpdateState({ phase: 'unsupported', supported: false });
    return;
  }

  setUpdateState({ supported: true });

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = { info: log, warn: log, error: log, debug: () => {} };

  autoUpdater.on('checking-for-update', () => setUpdateState({ phase: 'checking', message: null }));

  autoUpdater.on('update-available', (info) => {
    log(`Update available: ${info.version}`);
    setUpdateState({ phase: 'available', version: info.version, percent: 0, message: null });
  });

  autoUpdater.on('update-not-available', () => {
    log('Already up to date.');
    setUpdateState({ phase: 'up-to-date', version: null, message: null, lastCheckedAt: Date.now() });
  });

  autoUpdater.on('download-progress', (p) => {
    setUpdateState({ phase: 'downloading', percent: Math.round(p.percent || 0) });
  });

  autoUpdater.on('error', (err) => {
    const message = (err && err.message) || 'Unknown error';
    log(`Update check failed: ${message}`);
    setUpdateState({ phase: 'error', message });
  });

  autoUpdater.on('update-downloaded', async (info) => {
    log(`Update ${info.version} downloaded.`);
    setUpdateState({ phase: 'downloaded', version: info.version, percent: 100, message: null });

    if (updateState.autoInstall) {
      waitToRestart();
      return;
    }

    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      buttons: ['Restart now', 'Later'],
      defaultId: 0,
      cancelId: 1,
      title: 'Update ready',
      message: `Study Flow ${info.version} is ready to install.`,
      detail: 'Your work is saved. The app will reopen where you left off.',
    });
    // "Later" still installs on quit, so the update is never lost - and the
    // button in Settings stays on "Restart and update" until it does.
    if (response === 0) restartIntoUpdate();
  });

  autoUpdater.checkForUpdates().catch((e) => log(`Update check error: ${e.message}`));
  // And once every six hours for long-running sessions.
  setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, 6 * 60 * 60 * 1000);
}

/**
 * The manual path: the "Check for updates" button in Settings.
 *
 * Registered once at module scope rather than inside createWindow, so a second
 * window can never double-register the handler.
 */
ipcMain.handle('updates:status', () => updateState);

ipcMain.handle('updates:check', async () => {
  if (!isPackaged) {
    setUpdateState({ phase: 'unsupported', supported: false });
    return updateState;
  }
  try {
    setUpdateState({ phase: 'checking', message: null });
    await autoUpdater.checkForUpdates();
  } catch (e) {
    setUpdateState({ phase: 'error', message: (e && e.message) || 'Could not reach the update server' });
  }
  return updateState;
});

ipcMain.handle('updates:install', () => {
  if (updateState.phase !== 'downloaded') return updateState;
  // Let the IPC reply leave before the app tears itself down.
  setImmediate(restartIntoUpdate);
  return updateState;
});

ipcMain.handle('updates:set-auto', (_event, enabled) => {
  const autoInstall = enabled === true;
  try {
    fs.writeFileSync(path.join(appDataPath, 'update-settings.json'), JSON.stringify({ autoInstall }));
  } catch (e) {
    log(`Could not save the auto update setting: ${e.message}`);
    return updateState;
  }
  setUpdateState({ autoInstall });
  waitToRestart();
  return updateState;
});

async function createWindow() {
  Menu.setApplicationMenu(null);
  await setupDatabase();
  let port = 3000;
  
  mainWindow = new BrowserWindow({
    width: 1300,
    height: 900,
    // The app's layout has one breakpoint that matters: below md (768px) the
    // sidebar is replaced by the header's mobile menu. A desktop window can be
    // dragged to any size, so without a floor a user can quietly resize into
    // the phone layout on a 27" monitor. 960 keeps the rail and the dashboard's
    // two-column grid intact.
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#050505',
    show: false,
    icon: path.join(__dirname, 'icon.ico'),
    // No Windows title bar: the app's own header is the title bar (its empty
    // space is the drag region, .titlebar-drag in app/globals.css) and it
    // draws its own round minimise / maximise / close buttons
    // (components/WindowControls.tsx, ipc 'window:*' below). Dragging,
    // double-click to maximise, snapping and resizing from the edges work.
    //
    // frame: false, NOT titleBarStyle: 'hidden'. With 'hidden' (1.0.38) Windows
    // kept treating the top strip as its own title bar and real clicks there
    // landed on the wrong element: clicking maximise minimised. Tested with
    // real mouse clicks (scripted calls from the page do not show it).
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false
    }
  });

  // The header's maximise button swaps to "restore" while maximised.
  for (const evt of ['maximize', 'unmaximize']) {
    mainWindow.on(evt, () => mainWindow.webContents.send('window:maximized', evt === 'maximize'));
  }

  // Never open a bare Electron window. A web page asked for in a new window
  // (a saved link's "Open in browser", a link clicked inside a viewed page)
  // goes to the default browser; the app's own pages may still open.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const ownPage = /^http:\/\/(127\.0\.0\.1|localhost):\d+\//.test(url);
    if (ownPage) return { action: 'allow' };
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  // Saved links open inside the app (Resources > a link). Many sites send
  // X-Frame-Options / CSP frame-ancestors to refuse being shown in a frame;
  // inside this app the frame is ours and sandboxed (FileViewer LinkBody), so
  // those two headers are dropped for frames only. Top-level pages, scripts
  // and everything else keep every header.
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    if (details.resourceType !== 'subFrame' || !details.responseHeaders) return callback({});
    const headers = {};
    for (const [key, value] of Object.entries(details.responseHeaders)) {
      const name = key.toLowerCase();
      if (name === 'x-frame-options') continue;
      if (name === 'content-security-policy') {
        headers[key] = value.map((policy) =>
          policy.split(';').filter((d) => !/^\s*frame-ancestors\b/i.test(d)).join(';')
        );
        continue;
      }
      headers[key] = value;
    }
    callback({ responseHeaders: headers });
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
    
    // Ignore the app's own local pages (loading screen, error page)
    if (validatedURL && validatedURL.startsWith('file:')) return;

    log(`CLIENT CONNECTION FAILURE [Code ${errorCode}]: ${errorDescription} (at ${validatedURL})`);
    
    mainWindow.loadFile(path.join(__dirname, 'error.html'), { query: { port: port.toString() } });
  });

  // A real file, not a data: URL - see the comment at the top of loading.html.
  mainWindow.loadFile(loadingPagePath);

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
      LIBRARY_DIR: libraryPath,
      // Set explicitly so Next's env loader cannot fall back to a bundled
      // .env - it only fills in variables that are not already present.
      JWT_SECRET: getOrCreateJwtSecret(),
      ELECTRON_RUN_AS_NODE: '1',
      NEXT_TELEMETRY_DISABLED: '1'
    },
    shell: !isPackaged
  });

  let engineReady = false;
  nextProcess.stdout.on('data', (data) => {
    const text = data.toString().trim();
    log(`ENGINE: ${text}`);
    // Next prints "- Local: http://..." once it is listening, then "Ready".
    if (/Local:\s+http|Ready in/i.test(text)) engineReady = true;
  });
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

  // 60 seconds for slow HDDs. Checked every 100 ms: it used to be once a
  // second, which added up to a second of waiting after the server was up.
  const deadline = Date.now() + 60_000;
  const POLL_MS = 100;
  let attempts = 0;

  /**
   * Signed in already (a session cookie is kept for 30 days): open the
   * dashboard straight away. /login would only render, load its scripts and
   * then redirect to / in the browser - a second page load on every launch.
   * An expired cookie is still handled: the server's proxy sends it on.
   */
  const startUrl = async () => {
    const base = `http://${hostname}:${port}`;
    try {
      const cookies = await session.defaultSession.cookies.get({ url: base, name: 'session' });
      if (cookies.length > 0) return `${base}/`;
    } catch (e) {
      log(`Could not read the saved sign-in: ${e.message}`);
    }
    return `${base}/login`;
  };

  const waitForServer = async () => {
    // Both: the port accepts connections AND it is OUR engine that opened it.
    // The second half is what stops a foreign server on the same port from
    // being mistaken for ours (see portAnswers above).
    const isReady = engineReady && (await checkServer());
    if (isReady) {
      log('Engine stabilized. Synchronizing visual layers...');
      showStatus('Opening your plan…');

      mainWindow.loadURL(await startUrl());

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
    } else if (Date.now() < deadline) {
      attempts++;
      if (attempts % 50 === 0) log(`Still waiting for the engine (attempt ${attempts})...`);
      setTimeout(waitForServer, POLL_MS);
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

  // The mini window comes in fixed sizes rather than free resizing, so each
  // layout is designed for its size. Keep in step with WIDGET_SIZES in
  // app/focus/widget/page.tsx.
  const WIDGET_SIZES = {
    mini: { width: 360, height: 88 },
    compact: { width: 380, height: 184 },
    card: { width: 320, height: 420 },
  };
  const widgetSize = (name) => WIDGET_SIZES[name] || WIDGET_SIZES.compact;

  ipcMain.on('enter-widget', (event, arg) => {
    if (widgetWindow) return;

    mainWindow.hide();

    // Bottom-right corner of the screen by default.
    const { width: widgetWidth, height: widgetHeight } = widgetSize(arg && arg.size);
    const { x: areaX, y: areaY, width: areaWidth, height: areaHeight } = screen.getPrimaryDisplay().workArea;
    const x = areaX + areaWidth - widgetWidth - 24;
    const y = areaY + areaHeight - widgetHeight - 24;

    widgetWindow = new BrowserWindow({
      width: widgetWidth,
      height: widgetHeight,
      x: x,
      y: y,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      resizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: false,
      hasShadow: false,
      show: false,
      icon: path.join(__dirname, 'icon.ico'),
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
        backgroundThrottling: false
      }
    });
    // Stay above full-screen apps too (videos, slides).
    widgetWindow.setAlwaysOnTop(true, 'floating');

    widgetWindow.once('ready-to-show', () => {
      widgetWindow.show();
    });

    widgetWindow.loadURL(`http://127.0.0.1:${port}/focus/widget?taskId=${encodeURIComponent((arg && arg.taskId) || '')}`);

    widgetWindow.on('closed', () => {
      widgetWindow = null;
      // Show main window back if it was hidden
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
  });

  // Switch preset size. The corner nearest the screen's edge stays put, so a
  // widget parked bottom-right grows up and to the left.
  ipcMain.on('widget:size', (event, name) => {
    if (!widgetWindow || widgetWindow.isDestroyed() || event.sender !== widgetWindow.webContents) return;
    const next = widgetSize(name);
    const now = widgetWindow.getBounds();
    const area = screen.getDisplayMatching(now).workArea;
    const anchorRight = now.x + now.width / 2 > area.x + area.width / 2;
    const anchorBottom = now.y + now.height / 2 > area.y + area.height / 2;
    let x = anchorRight ? now.x + now.width - next.width : now.x;
    let y = anchorBottom ? now.y + now.height - next.height : now.y;
    x = Math.min(Math.max(x, area.x), area.x + area.width - next.width);
    y = Math.min(Math.max(y, area.y), area.y + area.height - next.height);
    widgetWindow.setBounds({ x, y, width: next.width, height: next.height });
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
