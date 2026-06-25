'use client';

import * as mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';

// PDF.js worker setup (mirrors app/ai/AIChatInterface.tsx).
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();
}

/** Extract all text from a PDF file using pdfjs-dist. */
export async function extractTextFromPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ('str' in item ? (item as { str: string }).str : ''))
      .join(' ');
    fullText += pageText + '\n\n';
  }
  return fullText;
}

/** Extract raw text from a .docx file using mammoth. */
export async function extractTextFromDocx(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

/** Read a file as a base64 data URI ("data:<mime>;base64,..."). */
export function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}

export type ReadTimetableResult =
  | { kind: 'image'; image: { data: string; mimeType: string } }
  | { kind: 'text'; text: string };

/**
 * Read a timetable file for AI analysis. Images are returned as a base64 data
 * URI for AI vision; PDF/DOCX/TXT are extracted to plain text client-side.
 * Throws on unsupported types or empty extraction.
 */
export async function readTimetableFile(file: File): Promise<ReadTimetableResult> {
  const name = file.name.toLowerCase();
  const type = (file.type || '').toLowerCase();

  if (type.startsWith('image/')) {
    const data = await fileToDataUri(file);
    return { kind: 'image', image: { data, mimeType: file.type || 'image/png' } };
  }

  if (type === 'application/pdf' || name.endsWith('.pdf')) {
    const text = (await extractTextFromPdf(file)).trim();
    if (!text) throw new Error("Couldn't read any text from that PDF. Try a clearer photo instead.");
    return { kind: 'text', text };
  }

  if (name.endsWith('.docx') || name.endsWith('.doc')) {
    const text = (await extractTextFromDocx(file)).trim();
    if (!text) throw new Error("Couldn't read any text from that document.");
    return { kind: 'text', text };
  }

  if (type === 'text/plain' || name.endsWith('.txt')) {
    const text = (await file.text()).trim();
    if (!text) throw new Error('That file appears to be empty.');
    return { kind: 'text', text };
  }

  throw new Error('Unsupported file type. Upload an image, PDF, or Word document.');
}
