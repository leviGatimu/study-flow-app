import * as fs from 'fs';
import * as path from 'path';

const dbPath = path.resolve(__dirname, '../prisma/dev.db');
const backupPath = path.resolve(__dirname, '../prisma/dev-backup.db');

async function main() {
  console.log('--- Database Restoration Initiated ---');

  if (!fs.existsSync(backupPath)) {
    console.error(`ERROR: Backup database file not found at: ${backupPath}`);
    process.exit(1);
  }

  console.log(`Restoring database from: ${backupPath} to: ${dbPath}...`);
  fs.copyFileSync(backupPath, dbPath);
  console.log('Database restored successfully.');

  console.log(`Removing backup file: ${backupPath}...`);
  fs.unlinkSync(backupPath);
  console.log('Backup file cleaned up.');
  console.log('--- Database Restoration Completed successfully ---');
}

main().catch(e => {
  console.error('Fatal error during restoration:', e);
  process.exit(1);
});
