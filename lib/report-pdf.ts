import { jsPDF } from 'jspdf';
import { hm, versusAverage, type ReportData } from './report-model.ts';

/**
 * A report as an A4 PDF, drawn with text and shapes (not a screenshot), so it
 * is sharp at any zoom, searchable and a few kilobytes. Runs on the server:
 * this is what gets filed in Resources > Reports. Plain wording only.
 */

const PAGE_W = 210;
const PAGE_H = 297;
const M = 16; // margin
const W = PAGE_W - M * 2;

const INK: [number, number, number] = [15, 23, 42];
const MUTED: [number, number, number] = [100, 116, 139];
const LINE: [number, number, number] = [226, 232, 240];
const SOFT: [number, number, number] = [248, 250, 252];
const GREEN: [number, number, number] = [16, 185, 129];
const RED: [number, number, number] = [239, 68, 68];
const BAR_COLORS: [number, number, number][] = [
  [59, 130, 246], [249, 115, 22], [139, 92, 246], [16, 185, 129], [236, 72, 153], [6, 182, 212], [245, 158, 11], [99, 102, 241],
];

function hex(color: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return [59, 130, 246];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function renderReportPdf(r: ReportData, generatedAt = new Date()): Uint8Array {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const accent = hex(r.color);
  let y = M;

  const color = (c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);
  const fill = (c: [number, number, number]) => doc.setFillColor(c[0], c[1], c[2]);
  const stroke = (c: [number, number, number]) => doc.setDrawColor(c[0], c[1], c[2]);
  const font = (size: number, style: 'normal' | 'bold' = 'normal') => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
  };
  /** Start a new page when `need` mm will not fit. */
  const room = (need: number) => {
    if (y + need > PAGE_H - M - 8) {
      doc.addPage();
      y = M;
    }
  };
  const heading = (text: string) => {
    room(14);
    y += 4;
    font(11, 'bold');
    color(INK);
    doc.text(text, M, y);
    y += 2;
    stroke(LINE);
    doc.setLineWidth(0.3);
    doc.line(M, y, M + W, y);
    y += 5;
  };

  // ---- Header
  fill(INK);
  doc.roundedRect(M, y, 7, 7, 1.5, 1.5, 'F');
  // The app's cube, three shaded faces.
  const cx = M + 3.5;
  const cy = y + 3.6;
  doc.setFillColor(255, 255, 255);
  doc.triangle(cx, cy - 2.4, cx + 2.1, cy - 1.2, cx, cy, 'F');
  doc.triangle(cx, cy - 2.4, cx - 2.1, cy - 1.2, cx, cy, 'F');
  doc.setFillColor(170, 178, 190);
  doc.triangle(cx - 2.1, cy - 1.2, cx, cy, cx, cy + 2.4, 'F');
  doc.triangle(cx - 2.1, cy - 1.2, cx - 2.1, cy + 1.2, cx, cy + 2.4, 'F');
  doc.setFillColor(110, 120, 135);
  doc.triangle(cx + 2.1, cy - 1.2, cx, cy, cx, cy + 2.4, 'F');
  doc.triangle(cx + 2.1, cy - 1.2, cx + 2.1, cy + 1.2, cx, cy + 2.4, 'F');
  font(10, 'bold');
  color(INK);
  doc.text('Study Flow', M + 9.5, y + 5);
  font(9);
  color(MUTED);
  doc.text(r.kind === 'daily' ? 'Daily report' : 'Weekly report', M + W, y + 5, { align: 'right' });
  y += 15;

  font(20, 'bold');
  color(INK);
  doc.text(r.title, M, y);
  y += 6;
  font(10);
  color(MUTED);
  doc.text(`${r.level} · score ${r.score} out of 100`, M, y);

  // Grade badge, top right of the title block.
  fill(accent);
  doc.roundedRect(M + W - 24, y - 15, 24, 18, 3, 3, 'F');
  font(20, 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(r.grade, M + W - 12, y - 4, { align: 'center' });
  font(7);
  doc.text('GRADE', M + W - 12, y + 0.5, { align: 'center' });
  y += 9;

  // ---- Summary sentence
  fill(SOFT);
  stroke(LINE);
  const feedback = doc.splitTextToSize(r.feedback, W - 10) as string[];
  const detail = doc.splitTextToSize(r.detail, W - 10) as string[];
  const boxH = 8 + feedback.length * 5 + detail.length * 4.5;
  doc.roundedRect(M, y, W, boxH, 2.5, 2.5, 'FD');
  fill(accent);
  doc.rect(M, y, 1.5, boxH, 'F');
  font(11, 'bold');
  color(INK);
  doc.text(feedback, M + 6, y + 7);
  font(9.5);
  color(MUTED);
  doc.text(detail, M + 6, y + 7 + feedback.length * 5);
  y += boxH + 6;

  // ---- Stat tiles
  const tiles = [
    { label: 'Studied', value: hm(r.doneMinutes), note: `of ${hm(r.plannedMinutes)} planned` },
    { label: 'Blocks done', value: `${r.blocksDone} / ${r.blocksTotal}`, note: r.blocksTotal ? `${Math.round((r.blocksDone / r.blocksTotal) * 100)}%` : 'none planned' },
    { label: 'Streak', value: `${r.streak} ${r.streak === 1 ? 'day' : 'days'}`, note: 'days in a row' },
    { label: 'Homework done', value: String(r.homework.length), note: r.kind === 'daily' ? 'that day' : 'that week' },
  ];
  const tileW = (W - 9) / 4;
  tiles.forEach((t, i) => {
    const x = M + i * (tileW + 3);
    stroke(LINE);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, y, tileW, 22, 2.5, 2.5, 'FD');
    font(8);
    color(MUTED);
    doc.text(t.label, x + 4, y + 6);
    font(14, 'bold');
    color(INK);
    doc.text(t.value, x + 4, y + 13.5);
    font(7.5);
    color(MUTED);
    doc.text(t.note, x + 4, y + 18.5);
  });
  y += 27;

  const vs = versusAverage(r);
  if (vs) {
    // Drawn, not typed: the built-in PDF fonts have no arrow glyphs.
    fill(vs.up ? GREEN : RED);
    if (vs.up) doc.triangle(M, y - 0.3, M + 3.2, y - 0.3, M + 1.6, y - 3, 'F');
    else doc.triangle(M, y - 3, M + 3.2, y - 3, M + 1.6, y - 0.3, 'F');
    font(9.5);
    color(INK);
    doc.text(vs.text, M + 5, y);
    y += 5;
  }

  // ---- Blocks (daily) or days (weekly)
  if (r.blocks.length) {
    heading('Blocks');
    for (const b of r.blocks) {
      room(8);
      fill(b.done ? GREEN : RED);
      doc.circle(M + 2, y - 1.3, 1.4, 'F');
      font(10, 'bold');
      color(INK);
      doc.text(b.subject, M + 7, y);
      font(9.5);
      color(MUTED);
      doc.text(`${b.start} – ${b.end}`, M + W - 28, y, { align: 'right' });
      font(9.5, 'bold');
      color(b.done ? GREEN : RED);
      doc.text(b.done ? 'Done' : 'Missed', M + W, y, { align: 'right' });
      y += 7;
    }
  }
  if (r.days.length) {
    heading('Each day');
    room(42);
    const max = Math.max(60, ...r.days.map((d) => d.minutes));
    const colW = W / 7;
    const chartH = 28;
    r.days.forEach((d, i) => {
      const x = M + i * colW + colW * 0.2;
      const h = (d.minutes / max) * chartH;
      fill(SOFT);
      doc.roundedRect(x, y, colW * 0.6, chartH, 1.5, 1.5, 'F');
      if (h > 0) {
        fill(accent);
        doc.roundedRect(x, y + chartH - h, colW * 0.6, h, 1.5, 1.5, 'F');
      }
      font(8);
      color(MUTED);
      doc.text(d.label, x + colW * 0.3, y + chartH + 5, { align: 'center' });
      font(7.5, 'bold');
      color(INK);
      doc.text(d.minutes ? hm(d.minutes) : '–', x + colW * 0.3, y + chartH + 9.5, { align: 'center' });
    });
    y += chartH + 13;
  }

  // ---- Subjects
  if (r.subjects.length) {
    heading('Time per subject');
    const total = r.subjects.reduce((s, b) => s + b.minutes, 0) || 1;
    r.subjects.forEach((s, i) => {
      room(10);
      const c = BAR_COLORS[i % BAR_COLORS.length];
      font(9.5, 'bold');
      color(INK);
      doc.text(s.label, M, y);
      font(9);
      color(MUTED);
      doc.text(`${hm(s.minutes)} · ${Math.round((s.minutes / total) * 100)}%`, M + W, y, { align: 'right' });
      y += 2;
      fill(SOFT);
      doc.roundedRect(M, y, W, 2.5, 1.2, 1.2, 'F');
      fill(c);
      doc.roundedRect(M, y, Math.max(2.5, (s.minutes / total) * W), 2.5, 1.2, 1.2, 'F');
      y += 7.5;
    });
  }

  // ---- Homework
  if (r.homework.length) {
    heading('Homework finished');
    for (const h of r.homework) {
      room(7);
      fill(GREEN);
      doc.circle(M + 2, y - 1.3, 1.2, 'F');
      font(9.5);
      color(INK);
      doc.text(`${h.title}`, M + 7, y);
      color(MUTED);
      doc.text(h.subject, M + W, y, { align: 'right' });
      y += 6;
    }
  }

  // ---- Went well / next time
  const list = (title: string, items: string[], dot: [number, number, number]) => {
    if (!items.length) return;
    heading(title);
    for (const item of items) {
      const lines = doc.splitTextToSize(item, W - 8) as string[];
      room(lines.length * 5 + 2);
      fill(dot);
      doc.circle(M + 2, y - 1.3, 1.1, 'F');
      font(9.5);
      color(INK);
      doc.text(lines, M + 7, y);
      y += lines.length * 5 + 1.5;
    }
  };
  list('What went well', r.strengths, GREEN);
  list(r.kind === 'daily' ? 'For tomorrow' : 'For next week', r.next, accent);

  // ---- Footer on every page
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    stroke(LINE);
    doc.line(M, PAGE_H - M, M + W, PAGE_H - M);
    font(7.5);
    color(MUTED);
    const stamp = generatedAt.toISOString().slice(0, 16).replace('T', ' ');
    doc.text(`Made by Study Flow from your study records · ${stamp} UTC`, M, PAGE_H - M + 5);
    doc.text(`Page ${p} of ${pages}`, M + W, PAGE_H - M + 5, { align: 'right' });
  }

  return new Uint8Array(doc.output('arraybuffer'));
}
