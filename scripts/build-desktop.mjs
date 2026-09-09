/**
 * Build the desktop (SQLite) bundle WITHOUT leaving the web app broken.
 *
 * THE TRAP THIS SCRIPT EXISTS TO CLOSE
 * ------------------------------------
 * `lib/prisma.ts` imports the generated client from one fixed path,
 * node_modules/.prisma/client-custom-v8, so both targets have to generate
 * there: the web build writes a POSTGRES client, the desktop build writes a
 * SQLITE one. Whichever ran last wins. A desktop build therefore used to leave
 * every web request failing with:
 *
 *   Invalid `prisma.user.findUnique()` invocation:
 *   error: Error validating datasource `db`: the URL must start with the
 *   protocol `file:`.
 *
 * ...and the only cure was remembering to run `npm run db:postgres` by hand.
 *
 * Simply restoring Postgres at the end is not enough on its own, because
 * desktop-app/package.json used to copy that same mutable path into the
 * installer (build.extraResources). Restoring would have quietly shipped a
 * POSTGRES client inside the desktop app - trading a loud dev-time failure for
 * a silent user-facing one.
 *
 * So this script does both halves:
 *
 *   1. generate the SQLite client at the shared path (so `next build` traces
 *      and bundles the right one into .next/standalone),
 *   2. SNAPSHOT it to node_modules/.prisma/client-sqlite-desktop - an immutable
 *      artifact that packaging reads instead of the live path,
 *   3. run `next build`,
 *   4. ALWAYS restore the Postgres client, even if the build failed.
 *
 * Both the snapshot and the restore are verified by reading the provider back
 * out of the generated client, so a half-finished generate (the EPERM failure
 * mode below) cannot pass silently.
 *
 * WINDOWS EPERM: `prisma generate` renames query_engine-windows.dll.node into
 * place. A running `next dev` has that DLL loaded, so the rename fails with
 * EPERM and leaves a half-written client plus .tmp copies behind (10 of them,
 * 19 MB each, were being traced into the installer). Stop the dev server before
 * building; this script checks and fails fast with that instruction.
 *
 *   node scripts/build-desktop.mjs             full desktop build
 *   node scripts/build-desktop.mjs --no-build  steps 1, 2 and 4 only - refresh
 *                                              and verify the desktop client
 *                                              without a 5-minute `next build`
 */

import { spawnSync } from "node:child_process";
import { cpSync, existsSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** The one path lib/prisma.ts imports from. Both providers generate here. */
const SHARED_CLIENT = join(root, "node_modules/.prisma/client-custom-v8");
/** Immutable copy of the SQLite client; desktop-app packaging reads this. */
const DESKTOP_SNAPSHOT = join(root, "node_modules/.prisma/client-sqlite-desktop");
/** Where `next build` leaves the traced copy of the client. */
const STANDALONE_CLIENT = join(
  root,
  ".next/standalone/node_modules/.prisma/client-custom-v8"
);

const skipBuild = process.argv.includes("--no-build");

function step(label) {
  console.log(`\n── ${label}`);
}

/**
 * Run one command through the shell. `npm` and `npx` are shell wrappers on
 * Windows, so shell:true is required; the command is passed as a single string
 * because passing an argv array alongside shell:true is deprecated (DEP0190).
 * Every command here is a hard-coded literal - nothing user-supplied is
 * interpolated into it.
 */
function run(command) {
  console.log(`   $ ${command}`);
  const result = spawnSync(command, { cwd: root, stdio: "inherit", shell: true });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`\`${command}\` exited with code ${result.status}`);
  }
}

/** Read the datasource provider back out of a generated client directory. */
function providerOf(clientDir) {
  const schema = join(clientDir, "schema.prisma");
  if (!existsSync(schema)) return null;
  const match = /datasource\s+db\s*\{[^}]*?provider\s*=\s*"([^"]+)"/s.exec(
    readFileSync(schema, "utf8")
  );
  return match ? match[1] : null;
}

function assertProvider(clientDir, expected, what) {
  const actual = providerOf(clientDir);
  if (actual !== expected) {
    throw new Error(
      `${what}: expected provider "${expected}" at ${clientDir}, found ${
        actual ? `"${actual}"` : "no generated schema"
      }`
    );
  }
  console.log(`   verified: ${what} -> provider "${actual}"`);
}

/**
 * Remove the query_engine-windows.dll.node.tmpNNNN files an EPERM-failed
 * generate leaves behind. They are 19 MB each and get traced into the
 * standalone build, so they end up inside the installer for no reason.
 */
function removeOrphanedEngines(dir) {
  if (!existsSync(dir)) return 0;
  let removed = 0;
  for (const name of readdirSync(dir)) {
    if (/query_engine-.*\.node\.tmp\d+$/.test(name)) {
      rmSync(join(dir, name), { force: true });
      removed += 1;
    }
  }
  if (removed) console.log(`   removed ${removed} orphaned engine .tmp file(s) from ${dir}`);
  return removed;
}

/**
 * Things that must NEVER end up inside the installer, and the check that they
 * did not.
 *
 * next.config.ts already lists these under outputFileTracingExcludes. That
 * config is not enough, and this is not belt-and-braces: on 2026-09-09 a build
 * with those excludes in place still produced a 950 MB .next/standalone
 * containing desktop-app/dist (473 MB - the PREVIOUS installer, nesting itself
 * again), setup/ (the published exe), and public/uploads (71 MB of one person's
 * PDFs, audio and proof-of-work photographs). The tracer's behaviour changed
 * under us and nothing said so.
 *
 * Deleting them here is deterministic in a way a tracer hint is not. The
 * assertion afterwards is the point, though: shipping somebody's private files
 * inside a public installer has now happened twice, and it must fail the build
 * rather than be noticed later.
 */
const MUST_NOT_SHIP = [
  "desktop-app",
  "setup",
  "promo",
  "demo",
  "backups",
  "docs",
  "test",
  "public/uploads",
  "node_modules/.prisma/client-sqlite-test",
];

/** A standalone server bigger than this means something is nesting again. */
const STANDALONE_LIMIT_MB = 250;

function directorySizeMb(dir) {
  let total = 0;
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) {
        try {
          total += statSync(full).size;
        } catch {
          // A file that vanished mid-walk is not worth failing a build over.
        }
      }
    }
  };
  walk(dir);
  return total / (1024 * 1024);
}

function pruneStandalone() {
  const standaloneRoot = join(root, ".next", "standalone");
  if (!existsSync(standaloneRoot)) throw new Error(".next/standalone does not exist");

  for (const relative of MUST_NOT_SHIP) {
    const target = join(standaloneRoot, relative);
    if (existsSync(target)) {
      const mb = statSync(target).isDirectory() ? directorySizeMb(target) : 0;
      rmSync(target, { recursive: true, force: true });
      console.log(`   pruned ${relative}${mb > 1 ? ` (${mb.toFixed(0)} MB)` : ""}`);
    }
  }

  // Loose databases and archives, wherever the tracer put them.
  const sweep = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) sweep(full);
      else if (/\.(db|zip)$|\.db\.bak/.test(entry.name)) {
        rmSync(full, { force: true });
        console.log(`   pruned ${full.slice(standaloneRoot.length + 1)}`);
      }
    }
  };
  sweep(standaloneRoot);

  const survivors = MUST_NOT_SHIP.filter((r) => existsSync(join(standaloneRoot, r)));
  if (survivors.length > 0) {
    throw new Error(
      `these must never be packaged and could not be removed: ${survivors.join(", ")}`
    );
  }

  const mb = directorySizeMb(standaloneRoot);
  console.log(`   .next/standalone is ${mb.toFixed(0)} MB`);
  if (mb > STANDALONE_LIMIT_MB) {
    throw new Error(
      [
        `.next/standalone is ${mb.toFixed(0)} MB, over the ${STANDALONE_LIMIT_MB} MB limit.`,
        "Something large is being traced in again. Check what is biggest with",
        "  du -sh .next/standalone/*",
        "and add it to MUST_NOT_SHIP above - do not just raise the limit.",
      ].join("\n")
    );
  }
}

let failure = null;

try {
  step("1/4  generate the SQLite client at the shared path");
  removeOrphanedEngines(SHARED_CLIENT);
  try {
    run("npm run db:sqlite");
  } catch (error) {
    throw new Error(
      `${error.message}\n\n` +
        "If this failed with EPERM on query_engine-windows.dll.node, a Node\n" +
        "process still has the Prisma engine loaded. Stop `next dev` (and any\n" +
        "`node .next/standalone/server.js`) and run this again."
    );
  }
  assertProvider(SHARED_CLIENT, "sqlite", "desktop client");

  step("2/4  snapshot it to the path the installer reads");
  rmSync(DESKTOP_SNAPSHOT, { recursive: true, force: true });
  cpSync(SHARED_CLIENT, DESKTOP_SNAPSHOT, {
    recursive: true,
    filter: (src) => !/query_engine-.*\.node\.tmp\d+$/.test(src),
  });
  assertProvider(DESKTOP_SNAPSHOT, "sqlite", "packaging snapshot");

  if (skipBuild) {
    step("3/4  next build  [SKIPPED: --no-build]");
    console.log(
      "   .next/standalone was NOT rebuilt. Do not package from this tree."
    );
  } else {
    step("3/4  next build");
    run("npx --no-install next build");
    removeOrphanedEngines(STANDALONE_CLIENT);

    console.log("\n   pruning what must never ship");
    pruneStandalone();
  }
} catch (error) {
  failure = error;
} finally {
  // Runs whether the build succeeded or not: the developer's web app must
  // never be left holding a SQLite client against a Postgres DATABASE_URL.
  step("4/4  restore the Postgres client for the web app");
  try {
    run("npm run db:postgres");
    assertProvider(SHARED_CLIENT, "postgresql", "web client");
  } catch (error) {
    console.error(
      "\n!! COULD NOT RESTORE THE POSTGRES CLIENT. `npm run dev` will fail with\n" +
        '!! "the URL must start with the protocol `file:`" until you run\n' +
        "!! `npm run db:postgres` yourself (stop the dev server first).\n" +
        `!! ${error.message}`
    );
    failure ??= error;
  }
}

if (failure) {
  console.error(`\nDesktop build FAILED: ${failure.message}`);
  process.exit(1);
}

console.log(
  skipBuild
    ? "\nDesktop client refreshed and snapshotted; web client restored."
    : "\nDesktop build complete. .next/standalone holds the SQLite client, the\n" +
        "installer will read node_modules/.prisma/client-sqlite-desktop, and the\n" +
        "web app is back on Postgres. Package with `npm run pack` in desktop-app/."
);
