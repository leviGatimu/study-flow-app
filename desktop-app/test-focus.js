// Temporary diagnostic: verify the upgraded focus screen end-to-end.
const { app, BrowserWindow, session } = require('electron');

const TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiJjbW96a2Ntb28wMDAwdjcxZnU1bDczaHE0IiwiZXhwIjoxNzgxMzg2ODE5fQ.jlne1FKev4dAxyjoMaBVgyhzvUve5nBZ5jM9d8Yup30';
const BASE = 'http://localhost:3000';
const wait = (ms) => new Promise(r => setTimeout(r, ms));

app.whenReady().then(async () => {
  try {
    await session.defaultSession.cookies.set({ url: BASE, name: 'session', value: TOKEN });
    const win = new BrowserWindow({ width: 1400, height: 900, show: true, webPreferences: { backgroundThrottling: false } });
    const errors = [];
    win.webContents.on('console-message', (e, level, msg) => { if (level >= 3) errors.push(msg.slice(0, 200)); });

    await win.loadURL(BASE + '/focus/free');
    await wait(12000);
    await win.webContents.executeJavaScript(`localStorage.removeItem('study-flow-focus'); localStorage.removeItem('study-flow-break-cycle'); 'ok'`);
    await win.loadURL(BASE + '/focus/free');
    await wait(8000);

    // Pick the 25·5 break preset, then start.
    const prep = await win.webContents.executeJavaScript(`(() => {
      const btns = [...document.querySelectorAll('button')];
      const preset = btns.find(x => x.textContent.trim() === '25 · 5');
      if (preset) preset.click();
      const start = btns.find(x => x.textContent.includes('ENTER FOCUS MODE'));
      if (start) { start.click(); return 'started, preset=' + !!preset; }
      return 'START NOT FOUND';
    })()`);
    console.log('[TEST] prep:', prep);
    await wait(6000);

    const snapshot = () => win.webContents.executeJavaScript(`(() => {
      const text = document.body.innerText;
      const match = text.match(/\\b\\d{1,2}:\\d{2}\\b/);
      return JSON.stringify({
        timer: match ? match[0] : 'none',
        objectives: text.includes('OBJECTIVES') || text.includes('Objectives'),
        canvas: !!document.querySelector('canvas')
      });
    })()`);

    const s1 = JSON.parse(await snapshot());
    await wait(6000);
    const s2 = JSON.parse(await snapshot());

    console.log('[TEST] snapshot1:', JSON.stringify(s1));
    console.log('[TEST] snapshot2:', JSON.stringify(s2));
    console.log('[TEST] timer ticking:', s1.timer !== s2.timer ? 'YES' : 'NO');
    console.log('[TEST] page errors:', errors.length ? errors.slice(0, 5) : 'none');

    await win.webContents.executeJavaScript(`localStorage.removeItem('study-flow-focus'); localStorage.removeItem('study-flow-break-cycle'); localStorage.removeItem('study-flow-objectives'); localStorage.removeItem('study-flow-now-playing'); 'cleared'`);
    app.exit(0);
  } catch (e) {
    console.error('[TEST] FATAL:', e);
    app.exit(1);
  }
});
