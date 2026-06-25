const { app, BrowserWindow, Menu, ipcMain, screen } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const net = require('net');

// 1. HARDWARE COMPATIBILITY: Enable GPU acceleration for smooth rendering of glassmorphism and animations
// app.disableHardwareAcceleration();

let mainWindow;
let nextProcess;

const isPackaged = app.isPackaged;
const appDataPath = app.getPath('userData');
const dbPath = path.join(appDataPath, 'database.db');
const logPath = path.join(appDataPath, 'debug.log');

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

async function setupDatabase() {
  log(`Initializing system storage...`);
  if (!fs.existsSync(appDataPath)) {
    fs.mkdirSync(appDataPath, { recursive: true });
  }

  // CRITICAL: Copy template if database is missing
  if (!fs.existsSync(dbPath)) {
    log(`Database not found. Provisioning fresh environment...`);
    const templatePath = path.join(rootDir, 'prisma', 'dev.db');
    if (fs.existsSync(templatePath)) {
      try {
        fs.copyFileSync(templatePath, dbPath);
        log(`Environment provisioned successfully.`);
      } catch (err) {
        log(`ERROR: Failed to provision database: ${err.message}`);
      }
    } else {
      log(`WARNING: Template not found at ${templatePath}`);
    }
  }

  process.env.DATABASE_URL = `file:${dbPath}`;
  log(`Database locked at: ${dbPath}`);
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

  mainWindow.once('ready-to-show', () => mainWindow.show());

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
