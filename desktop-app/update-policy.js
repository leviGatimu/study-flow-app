/**
 * When auto update may restart the app by itself. Plain, so `node --test` can
 * check it without Electron.
 */

/** Long enough that a restart will not land in the middle of what someone is doing. */
const IDLE_SECONDS_BEFORE_RESTART = 2 * 60;

/** Reading a page or running a timer leaves the keyboard idle, so idle alone is not enough. */
function focusSessionRunning(savedFocus) {
  if (!savedFocus) return false;
  try {
    const focus = JSON.parse(savedFocus);
    return Boolean(focus && focus.activeTask && focus.step !== 'DONE');
  } catch {
    // Unreadable means unknown, and a killed focus timer is the worse mistake.
    return true;
  }
}

function safeToRestart({ idleSeconds, savedFocus }) {
  return idleSeconds >= IDLE_SECONDS_BEFORE_RESTART && !focusSessionRunning(savedFocus);
}

module.exports = { IDLE_SECONDS_BEFORE_RESTART, focusSessionRunning, safeToRestart };
