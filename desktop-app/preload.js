const { contextBridge, ipcRenderer } = require('electron');

/**
 * The only bridge between the app and Electron.
 *
 * Channels stay allow-listed rather than forwarded blindly: the renderer loads
 * a full Next.js app, and nothing it renders should be able to reach an
 * arbitrary main-process handler.
 */
contextBridge.exposeInMainWorld('electron', {
  platform: process.platform,
  send: (channel, data) => {
    const validChannels = ['enter-widget', 'exit-widget'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  library: {
    /** Open a folder of the resource library in Explorer. */
    open: (absolutePath) => ipcRenderer.invoke('library:open', absolutePath),
    /** Open Explorer with this library file selected. */
    reveal: (absolutePath) => ipcRenderer.invoke('library:reveal', absolutePath),
  },
  updates: {
    /** Current state, for the first paint. */
    status: () => ipcRenderer.invoke('updates:status'),
    /** What the "Check for updates" button calls. */
    check: () => ipcRenderer.invoke('updates:check'),
    /** Restart into the staged update. Only does anything once downloaded. */
    install: () => ipcRenderer.invoke('updates:install'),
    /** Live state while a check or download runs; returns an unsubscribe. */
    subscribe: (callback) => {
      const handler = (_event, state) => callback(state);
      ipcRenderer.on('updates:status', handler);
      return () => ipcRenderer.removeListener('updates:status', handler);
    },
  },
});
