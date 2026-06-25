import { DatabaseSync } from 'node:sqlite';
import * as fs from 'fs';
import * as path from 'path';

const dbPath = path.resolve(__dirname, '../prisma/dev.db');
const backupPath = path.resolve(__dirname, '../prisma/dev-backup.db');

async function main() {
  console.log('--- Database Sanitization Initiated ---');

  // 1. Check if source database exists
  if (!fs.existsSync(dbPath)) {
    console.error(`ERROR: Database file not found at: ${dbPath}`);
    process.exit(1);
  }

  // 2. Create database backup
  console.log(`Creating database backup: ${backupPath}...`);
  fs.copyFileSync(dbPath, backupPath);
  console.log('Database backup created successfully.');

  // 3. Open database and purge data tables
  console.log(`Opening database at: ${dbPath}...`);
  const db = new DatabaseSync(dbPath);

  // Disable foreign keys temporarily to allow bulk deletes in any order
  db.exec('PRAGMA foreign_keys = OFF;');

  const tables = [
    'User',
    'Task',
    'SubjectGoal',
    'ReportCard',
    'SubjectGrade',
    'Homework',
    'Project',
    'ProjectDoc',
    'ChatSession',
    'ChatMessage',
    'StickyNote',
    'AiNote',
    'ScheduleTemplate',
    'WeeklySummary',
    'UserProgress',
    'Resource',
    'ExamEvent',
    'MarkedDay',
    'MasteryItem',
    'StudioNote',
    'QuizAttempt',
    'TutorModule'
  ];

  console.log('Wiping user tables...');
  for (const table of tables) {
    try {
      db.exec(`DELETE FROM "${table}";`);
      console.log(`  - Cleaned table: ${table}`);
    } catch (err: any) {
      // If table doesn't exist, log it (e.g. if schema changed or table wasn't generated yet)
      console.log(`  - Table ${table} skip/error: ${err.message}`);
    }
  }

  // Shrink the database file size after deletion (VACUUM)
  console.log('Vacuuming database to reclaim space...');
  db.exec('VACUUM;');

  db.exec('PRAGMA foreign_keys = ON;');
  console.log('--- Database Sanitization Completed successfully ---');
}

main().catch(e => {
  console.error('Fatal error during sanitization:', e);
  process.exit(1);
});
