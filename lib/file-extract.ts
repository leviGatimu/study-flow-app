'use client';

import * as mammoth from 'mammoth';

/**
 * pdf.js is loaded on demand, in the browser, and never at module scope.
 *
 * 'use client' does not mean "client only": Next still evaluates this module
 * on the server to render the component that imports it. pdf.js builds a
 * `new DOMMatrix()` while it is being imported, and Node has no such global,
 * so a static import threw
 *
 *   ReferenceError: DOMMatrix is not defined
 *
 * on the server for every page that reached this file - /exams among them,
 * which is why that page arrived with an empty body and had to re-render on
 * the client to show anything. Loading it inside the function keeps it out of
 * the server pass entirely.
 */
type PdfJs = typeof import('pdfjs-dist');
let pdfjsPromise: Promise<PdfJs> | null = null;

function loadPdfjs(): Promise<PdfJs> {
  pdfjsPromise ??= import('pdfjs-dist').then((pdfjsLib) => {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
    return pdfjsLib;
  });
  return pdfjsPromise;
}

/** Extract all text from a PDF file using pdfjs-dist. */
export async function extractTextFromPdf(file: File): Promise<string> {
  const pdfjsLib = await loadPdfjs();
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
 * How much of a document is worth sending to a model.
 *
 * Roughly 40k characters, about 25 pages of prose. Past that the useful signal
 * is drowned anyway, the request gets slow, and on a metered key it gets
 * expensive. Every other caller in this app silently slices at 24-30k; this one
 * reports what it used so the UI can say so out loud, because a student whose
 * last three chapters were quietly ignored has no way to work out why the
 * questions all came from the beginning.
 */
export const MAX_STUDY_CHARS = 40_000;

export type StudyDocument = {
  /** The file's own name, for display and for the saved set. */
  name: string;
  /** Extracted text, already capped at MAX_STUDY_CHARS. */
  text: string;
  /** A photographed page, when the upload was an image rather than a document. */
  image?: { data: string; mimeType: string };
  /** Characters before capping, so the UI can say how much was left out. */
  totalChars: number;
  /** True when the document was longer than MAX_STUDY_CHARS. */
  truncated: boolean;
  pageCount?: number;
};

/**
 * Read a study document: a PDF, a Word file, a text file, or a photo of a page.
 *
 * Sibling of readTimetableFile rather than a replacement - that one returns a
 * union the timetable importers switch on, and this one returns a single shape
 * with the extra facts the generator needs (length, page count, whether
 * anything was cut). Both share loadPdfjs(), so pdf.js is still imported in
 * exactly one place and still never at module scope.
 */
export async function readStudyDocument(file: File): Promise<StudyDocument> {
  const name = file.name;
  const lower = name.toLowerCase();
  const type = (file.type || '').toLowerCase();

  const cap = (raw: string): StudyDocument => {
    const text = raw.trim();
    return {
      name,
      text: text.slice(0, MAX_STUDY_CHARS),
      totalChars: text.length,
      truncated: text.length > MAX_STUDY_CHARS,
    };
  };

  if (type.startsWith('image/')) {
    const data = await fileToDataUri(file);
    return {
      name,
      text: '',
      image: { data, mimeType: file.type || 'image/png' },
      totalChars: 0,
      truncated: false,
    };
  }

  if (type === 'application/pdf' || lower.endsWith('.pdf')) {
    const pdfjsLib = await loadPdfjs();
    const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    let out = '';
    // Stop reading once there is more than enough. A 300-page PDF is parsed on
    // the main thread, and pages past the cap cost seconds for text nobody will
    // ever send.
    let page = 1;
    for (; page <= pdf.numPages && out.length < MAX_STUDY_CHARS; page++) {
      const content = await (await pdf.getPage(page)).getTextContent();
      out +=
        content.items
          .map((item) => ('str' in item ? (item as { str: string }).str : ''))
          .join(' ') + '\n\n';
    }
    const result = cap(out);
    if (!result.text) {
      throw new Error(
        "No text could be read from that PDF. If it is a scan, upload it as an image instead."
      );
    }
    // Pages beyond the cap were never opened, so say the real total.
    return { ...result, pageCount: pdf.numPages, truncated: result.truncated || page <= pdf.numPages };
  }

  // Legacy binary .doc is NOT .docx. mammoth cannot read it and fails with a
  // zip error that means nothing to a student, so say the useful thing instead.
  if (lower.endsWith('.doc') && !lower.endsWith('.docx')) {
    throw new Error('Old .doc files cannot be read. Open it in Word and "Save As" .docx, then try again.');
  }

  if (lower.endsWith('.docx')) {
    const result = cap(await extractTextFromDocx(file));
    if (!result.text) throw new Error('That document appears to be empty.');
    return result;
  }

  if (type === 'text/plain' || lower.endsWith('.txt') || lower.endsWith('.md')) {
    const result = cap(await file.text());
    if (!result.text) throw new Error('That file appears to be empty.');
    return result;
  }

  throw new Error('Upload a PDF, a Word (.docx) file, a text file, or a photo of your notes.');
}

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
