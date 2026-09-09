========================================================================
             STUDY TRACKER - WINDOWS SETUP & INSTALLATION
========================================================================

This folder contains the Windows executable installer for the Study Tracker
desktop application.

Current build: 1.0.2  (103 MB)
Published at : https://github.com/leviGatimu/Study-Flow/releases/tag/v1.0.2

------------------------------------------------------------------------
1. WHAT'S INCLUDED
------------------------------------------------------------------------
* StudyTrackerSetup.exe:
  - Full standalone Windows installer for Study Tracker.
  - Bundled with a local Next.js server runtime, SQLite local database,
    and Electron desktop wrapper.
  - Runs 100% offline and locally without external database requirements.
  - Byte-identical to the installer attached to the release above, so a
    user who runs this file and a user who auto-updates end up on the
    same build.

------------------------------------------------------------------------
2. INSTALLATION INSTRUCTIONS
------------------------------------------------------------------------
1. Double-click "StudyTrackerSetup.exe".
2. Follow the setup wizard to choose your installation location and
   create shortcuts (Desktop / Start Menu).
3. Click "Install".
4. Once completed, open Study Tracker from your Desktop or Start Menu.
   The app will automatically launch its internal server and display
   your study dashboard.

Installing over an existing copy is safe. The database, uploaded files
and login session live in %APPDATA%\study-tracker-desktop, which the
installer never touches.

------------------------------------------------------------------------
3. HOW UPDATES REACH USERS
------------------------------------------------------------------------
The app checks GitHub Releases on launch and every six hours, and
Settings -> Desktop app has a "Check for updates" button. Both read the
`latest.yml` attached to the newest release.

A release is only found if ALL of these hold:
  * it lives in leviGatimu/Study-Flow - the repo every shipped build is
    compiled to look at. This is NOT the same as the code repo
    (leviGatimu/study-flow-app); publishing there reaches nobody.
  * it is a normal release: drafts and pre-releases are both ignored.
  * BOTH latest.yml and StudyTrackerSetup.exe are attached as assets.
  * its version is higher than the one the user is running.

------------------------------------------------------------------------
4. HOW TO REBUILD AND SHIP A NEW VERSION
------------------------------------------------------------------------
1. Bump "version" in desktop-app/package.json. An update is only offered
   if this number goes up.

2. Stop the dev server first - a running `next dev` holds the Prisma
   engine DLL and the build dies with EPERM half-written.

3. In the main project directory, build the desktop bundle:
   npm run build:desktop

   This generates the SQLite Prisma client, snapshots it for packaging,
   builds Next, and then restores the Postgres client for the web app on
   its own. No manual `npm run db:postgres` afterwards - the script does
   it even if the build fails.

4. Switch to the desktop-app folder and package the installer:
   cd desktop-app
   npm run dist

5. Copy the generated file from:
   desktop-app\dist\StudyTrackerSetup.exe
   into this "setup" folder.

6. Publish the release (PowerShell - one line, no backslash
   continuations, and pass --repo or gh will use the code repo instead):

   gh release create v1.0.2 dist\StudyTrackerSetup.exe dist\latest.yml --repo leviGatimu/Study-Flow --title "Study Flow 1.0.2" --notes "what changed"

========================================================================
