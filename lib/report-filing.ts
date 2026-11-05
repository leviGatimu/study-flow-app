import { prisma } from '@/lib/prisma';
import { INCLUDE_DELETED } from '@/lib/soft-delete';
import { byClass, type ClassScope } from '@/lib/scope';
import { storeResourceFile } from '@/lib/library-store';
import { renderReportPdf } from '@/lib/report-pdf';
import type { ReportData } from '@/lib/report-model';

/**
 * File each report as a PDF in Resources > Reports > Daily / Weekly.
 *
 * Deliberately NOT a 'use server' module: it takes a userId and a scope, so a
 * client must never be able to call it. The Reports page calls it after its
 * response is sent, so filing never slows the page down.
 *
 * Each report is filed once, by its file name. A name that exists in the
 * folder, INCLUDING a deleted one, is skipped: a report someone deleted (in
 * the app, or in Explorer on the desktop) stays deleted.
 */
export const REPORTS_SUBJECT = 'Reports';
export const reportFolder = (kind: ReportData['kind']) => (kind === 'daily' ? 'Daily' : 'Weekly');

export async function fileReports(userId: string, scope: ClassScope | null, reports: ReportData[]): Promise<number> {
  if (!reports.length || scope?.isArchive) return 0;

  const existing = await prisma.resource.findMany({
    where: { userId, subject: REPORTS_SUBJECT, ...byClass(scope), ...INCLUDE_DELETED },
    select: { title: true, folder: true },
  });
  const taken = new Set(existing.map((r) => `${r.folder}/${r.title}`.toLowerCase()));

  let filed = 0;
  for (const report of reports) {
    const folder = reportFolder(report.kind);
    if (taken.has(`${folder}/${report.fileName}`.toLowerCase())) continue;
    try {
      const bytes = renderReportPdf(report);
      const file = new File([bytes as BlobPart], report.fileName, { type: 'application/pdf' });
      const stored = await storeResourceFile(scope, REPORTS_SUBJECT, folder, file);
      await prisma.resource.create({
        data: { userId, subject: REPORTS_SUBJECT, title: stored.title, type: 'FILE', url: stored.url, folder, ...byClass(scope) },
      });
      taken.add(`${folder}/${report.fileName}`.toLowerCase());
      filed++;
    } catch (error) {
      // One report failing (a full disk, storage down) must not stop the rest
      // or the page; it is tried again on the next visit.
      console.error(`[reports] could not file ${report.fileName}:`, error);
    }
  }
  return filed;
}

/** Where each report's PDF is, by file name, for the Download buttons. */
export async function filedReportUrls(userId: string, scope: ClassScope | null): Promise<Record<string, string>> {
  const rows = await prisma.resource.findMany({
    where: { userId, subject: REPORTS_SUBJECT, type: 'FILE', ...byClass(scope) },
    select: { title: true, folder: true, url: true },
  });
  return Object.fromEntries(rows.map((r) => [`${r.folder}/${r.title}`, r.url]));
}
