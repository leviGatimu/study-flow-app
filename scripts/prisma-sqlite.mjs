/**
 * Generate prisma/schema.sqlite.prisma from the canonical Postgres schema.
 *
 * Prisma's `provider` cannot be an environment variable, and one schema file
 * cannot serve two databases - so the desktop build derives its schema from the
 * web one at build time. The Postgres schema stays the single source of truth;
 * this file is generated and should never be edited by hand.
 *
 *   node scripts/prisma-sqlite.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = resolve(root, "prisma/schema.prisma");
const OUT = resolve(root, "prisma/schema.sqlite.prisma");

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

const banner = `// GENERATED FILE - DO NOT EDIT.
// Produced from prisma/schema.prisma by scripts/prisma-sqlite.mjs.
// Edit the Postgres schema and re-run that script instead.

`;

writeFileSync(OUT, banner + schema, "utf8");

const models = (schema.match(/^model /gm) || []).length;
console.log(`wrote prisma/schema.sqlite.prisma (${models} models)`);
