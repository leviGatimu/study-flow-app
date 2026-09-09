/**
 * Generate prisma/schema.sqlite.prisma from the canonical Postgres schema.
 *
 * Prisma's `provider` cannot be an environment variable, and one schema file
 * cannot serve two databases - so the desktop build derives its schema from the
 * web one at build time. The Postgres schema stays the single source of truth;
 * this file is generated and should never be edited by hand.
 *
 *   node scripts/prisma-sqlite.mjs           desktop build (shared client path)
 *   node scripts/prisma-sqlite.mjs --test    sync harness (private client path)
 *
 * WHY --test EXISTS: the desktop build generates its client OVER the web one,
 * because both use the same output path. That is fine for a build, but it makes
 * the sync harness unrunnable while you are developing - generating a SQLite
 * client to test against would swap the client out from under `npm run dev`,
 * and on Windows the generate then dies with EPERM half-finished, leaving the
 * app broken with "the URL must start with the protocol file:". --test writes
 * to a private path instead, so the harness never touches the app's client.
 *
 * DO NOT CALL THE DESKTOP MODE DIRECTLY. `npm run db:sqlite` is a primitive: it
 * leaves the shared client pointing at SQLite, which breaks `npm run dev`. Use
 * `npm run build:desktop` (scripts/build-desktop.mjs), which snapshots the
 * SQLite client for the installer and then always restores the Postgres one.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const isTest = process.argv.includes("--test");

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = resolve(root, "prisma/schema.prisma");
const OUT = resolve(
  root,
  isTest ? "prisma/schema.sqlite-test.prisma" : "prisma/schema.sqlite.prisma"
);
const CLIENT_OUT = "../node_modules/.prisma/client-sqlite-test";

let schema = readFileSync(SRC, "utf8");

// 1. Swap the datasource. SQLite has no directUrl (there is no pooler to
//    bypass), and the file path comes from the Electron main process, which
//    sets DATABASE_URL to file:<userData>/database.db before booting the server.
schema = schema.replace(
  /datasource\s+db\s*\{[\s\S]*?\n\}/,
  `datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}`
);

// 2. Postgres-only native type annotations, if any are ever added.
schema = schema.replace(/\s*@db\.[A-Za-z]+(\([^)]*\))?/g, "");

// 3. For the harness only: redirect the generated client to a private path so
//    it cannot clobber the client the running app is using.
if (isTest) {
  schema = schema.replace(
    /(generator\s+client\s*\{[\s\S]*?output\s*=\s*)"[^"]*"/,
    `$1"${CLIENT_OUT}"`
  );
}

const banner = `// GENERATED FILE - DO NOT EDIT.
// Produced from prisma/schema.prisma by scripts/prisma-sqlite.mjs.
// Edit the Postgres schema and re-run that script instead.

`;

writeFileSync(OUT, banner + schema, "utf8");

const models = (schema.match(/^model /gm) || []).length;
const rel = OUT.slice(root.length + 1).replace(/\\/g, "/");
console.log(`wrote ${rel} (${models} models)`);

if (!isTest) {
  console.log(
    "note: the generate that follows overwrites the SHARED Prisma client with a\n" +
      "      SQLite one, which breaks `npm run dev`. `npm run build:desktop`\n" +
      "      restores Postgres afterwards; if you ran `npm run db:sqlite` by\n" +
      "      hand, run `npm run db:postgres` when you are done."
  );
}
