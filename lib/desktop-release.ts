import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Where the website sends people to get the desktop app.
 *
 * The URL points at `releases/latest/download/...`, not at a pinned tag, so
 * publishing a new release makes the site serve it without anyone remembering
 * to edit this file. A stale download link is worse than none: it hands people
 * an installer that then tells them it is out of date.
 *
 * The version is read from desktop-app/package.json - the same number
 * electron-builder stamps into the installer and into latest.yml - so the
 * badge on the page cannot drift from what the button actually downloads.
 */
export const DESKTOP_DOWNLOAD_URL =
  'https://github.com/leviGatimu/Study-Flow/releases/latest/download/StudyTrackerSetup.exe';

export const DESKTOP_RELEASES_URL = 'https://github.com/leviGatimu/Study-Flow/releases';

export function desktopVersion(): string {
  try {
    const pkg = readFileSync(join(process.cwd(), 'desktop-app', 'package.json'), 'utf8');
    return (JSON.parse(pkg).version as string) || '';
  } catch {
    // Packaged builds do not ship desktop-app/. The button still works; it
    // simply shows no version, which is better than showing a wrong one.
    return '';
  }
}
