/**
 * Grant (or revoke) admin rights from the command line.
 *
 * This exists because of a bootstrapping problem: admin rights can only be
 * granted by an existing admin, and a fresh deployment has none. Requiring
 * database access to appoint the first one is the point - it means the console
 * cannot be reached by anyone who has merely registered an account.
 *
 *   node scripts/make-admin.mjs <username>
 *   node scripts/make-admin.mjs <username> --revoke
 *
 * Run with the dev server stopped if you have just changed the schema; the
 * running server holds the old Prisma client.
 */

import pkg from '../node_modules/.prisma/client-custom-v8/index.js';

const { PrismaClient } = pkg;
const prisma = new PrismaClient();

const username = process.argv[2];
const revoke = process.argv.includes('--revoke');

if (!username) {
  console.error('usage: node scripts/make-admin.mjs <username> [--revoke]');
  process.exit(1);
}

const user = await prisma.user.findUnique({
  where: { username },
  select: { id: true, username: true, isAdmin: true },
});

if (!user) {
  const all = await prisma.user.findMany({ select: { username: true } });
  console.error(`No account called "${username}". Existing accounts: ${all.map((u) => u.username).join(', ')}`);
  await prisma.$disconnect();
  process.exit(1);
}

if (user.isAdmin === !revoke) {
  console.log(`${user.username} is already ${revoke ? 'not an admin' : 'an admin'}. Nothing to do.`);
  await prisma.$disconnect();
  process.exit(0);
}

// Refuse to remove the last admin: a deployment with none has no way to appoint
// one except this script, and whoever needs it may not have the database.
if (revoke) {
  const admins = await prisma.user.count({ where: { isAdmin: true } });
  if (admins <= 1) {
    console.error('That is the only admin. Appoint another one first.');
    await prisma.$disconnect();
    process.exit(1);
  }
}

await prisma.user.update({ where: { id: user.id }, data: { isAdmin: !revoke } });
console.log(`${user.username} is ${revoke ? 'no longer an admin' : 'now an admin'}.`);

await prisma.$disconnect();
