/**
 * The rules behind the resource library: what a name may be, how a folder
 * path is normalised and rebased, and how a stored "/library/..." URL maps to
 * a path on disk without ever escaping the library root.
 *
 * The last of those is the security boundary for app/library/[...path]: a URL
 * the client sends is the only input, so every way of writing ".." has to be
 * refused here rather than repaired.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { sep } from 'node:path';

import { nameError, safeSegment } from '../lib/library-names.ts';
import {
  normalizeFolder,
  folderParent,
  folderName,
  joinFolder,
  isWithinFolder,
  rebaseFolder,
  folderAncestors,
} from '../lib/library-paths.ts';
import {
  dedupeName,
  libraryRoot,
  libraryUrlFor,
  resolveLibraryUrl,
  libraryDisplayPath,
  fileNameFromUrl,
  extensionOf,
  isIgnoredEntry,
} from '../lib/library.ts';

const ROOT =
  process.platform === 'win32'
    ? 'C:\\Users\\levi\\Documents\\Study Tracker'
    : '/home/levi/Documents/Study Tracker';
const P = (...parts) => [ROOT, ...parts].join(sep);

describe('names', () => {
  test('ordinary names pass', () => {
    assert.equal(nameError('Chapter 1'), null);
    assert.equal(nameError('notes (final).pdf'), null);
    assert.equal(nameError("Levi's revision"), null);
  });

  test('Windows-invalid characters are refused with the list of offenders', () => {
    for (const bad of ['a/b', 'a\\b', 'what?', 'a:b', 'a|b', '<x>', 'q"q', 'star*']) {
      assert.match(nameError(bad) ?? '', /cannot contain/, bad);
    }
  });

  test('reserved device names, trailing dots and dot names are refused', () => {
    assert.match(nameError('CON') ?? '', /reserved/);
    assert.match(nameError('com1.txt') ?? '', /reserved/);
    assert.match(nameError('trailing.') ?? '', /end with/);
    assert.match(nameError('..') ?? '', /not allowed/);
    assert.match(nameError('   ') ?? '', /name/);
  });

  test('safeSegment coerces rather than refuses', () => {
    assert.equal(safeSegment('2025/2026'), '2025-2026');
    assert.equal(safeSegment('Physics?'), 'Physics');
    assert.equal(safeSegment('  C   programming  '), 'C programming');
    assert.equal(safeSegment('CON'), '_CON');
    assert.equal(safeSegment('...'), 'Untitled');
    assert.equal(safeSegment('Math (revision).'), 'Math (revision)');
  });
});

describe('folder paths', () => {
  test('normalises separators and empties, refuses bad segments', () => {
    assert.equal(normalizeFolder(''), '');
    assert.equal(normalizeFolder(null), '');
    assert.equal(normalizeFolder('/a//b/'), 'a/b');
    assert.equal(normalizeFolder('a\\b'), 'a/b');
    assert.throws(() => normalizeFolder('a/../b'), /not allowed/);
    assert.throws(() => normalizeFolder('a/b?'), /cannot contain/);
  });

  test('parent, name, join, ancestors', () => {
    assert.equal(folderParent('a/b/c'), 'a/b');
    assert.equal(folderParent('a'), '');
    assert.equal(folderName('a/b/c'), 'c');
    assert.equal(joinFolder('', 'x'), 'x');
    assert.equal(joinFolder('a/b', 'x'), 'a/b/x');
    assert.deepEqual(folderAncestors('a/b/c'), ['a', 'a/b']);
    assert.deepEqual(folderAncestors('a'), []);
  });

  test('isWithinFolder does not confuse "ab" with "a"', () => {
    assert.equal(isWithinFolder('a/b', 'a'), true);
    assert.equal(isWithinFolder('a', 'a'), true);
    assert.equal(isWithinFolder('ab/c', 'a'), false);
    assert.equal(isWithinFolder('anything', ''), true);
  });

  test('rebaseFolder rewrites descendants after a rename or move', () => {
    assert.equal(rebaseFolder('Ch1', 'Ch1', 'Chapter 1'), 'Chapter 1');
    assert.equal(rebaseFolder('Ch1/Worksheets', 'Ch1', 'Chapter 1'), 'Chapter 1/Worksheets');
    assert.equal(rebaseFolder('Ch1/Worksheets', 'Ch1', 'Archive/Ch1'), 'Archive/Ch1/Worksheets');
    assert.equal(rebaseFolder('Ch10', 'Ch1', 'X'), 'Ch10', 'a sibling with a shared prefix is untouched');
    assert.equal(rebaseFolder('Ch1', 'Ch1', ''), '', 'moving to the root');
  });

  test('dedupeName counts up like Explorer', () => {
    const taken = new Set(['notes.pdf', 'notes (2).pdf']);
    assert.equal(dedupeName('notes.pdf', (c) => taken.has(c)), 'notes (3).pdf');
    assert.equal(dedupeName('fresh.pdf', (c) => taken.has(c)), 'fresh.pdf');
    assert.equal(dedupeName('README', (c) => c === 'README'), 'README (2)');
  });
});

describe('library urls', () => {
  test('a year label becomes a directory; no class means the root itself', () => {
    assert.equal(libraryRoot('Year 2', ROOT), P('Year 2'));
    assert.equal(libraryRoot('2025/2026', ROOT), P('2025-2026'));
    assert.equal(libraryRoot(null, ROOT), ROOT);
  });

  test('path -> url -> path round-trips, with awkward characters encoded', () => {
    const file = P('Year 2', 'Physics', 'Chapter 1', 'notes #3 (final).pdf');
    const url = libraryUrlFor(file, ROOT);
    assert.equal(url, '/library/Year%202/Physics/Chapter%201/notes%20%233%20(final).pdf');
    assert.equal(resolveLibraryUrl(url, ROOT), file);
    assert.equal(libraryDisplayPath(url), 'Year 2\\Physics\\Chapter 1\\notes #3 (final).pdf');
    assert.equal(fileNameFromUrl(url), 'notes #3 (final).pdf');
    assert.equal(extensionOf(url), 'pdf');
  });

  test('libraryUrlFor refuses a path outside the root', () => {
    assert.throws(() => libraryUrlFor(P('..', 'elsewhere.pdf'), ROOT), /outside/);
  });

  test('every spelling of an escape is refused', () => {
    for (const url of [
      '/library/../secrets.txt',
      '/library/Year%202/..%2F..%2Fsecrets.txt',
      '/library/%2e%2e/secrets.txt',
      '/library/Year 2/./x',
      '/library/',
      '/library',
      '/uploads/x.pdf',
      '/library/Year%202/a%00b',
      '/library/Year%202/%E0%A4%A',
    ]) {
      assert.equal(resolveLibraryUrl(url, ROOT), null, url);
    }
  });

  test('disabled library resolves nothing', () => {
    assert.equal(resolveLibraryUrl('/library/Year%202/x.pdf', null), null);
  });

  test('editor and OS droppings are ignored by the walk', () => {
    for (const noise of ['desktop.ini', 'Thumbs.db', '~$notes.docx', '.DS_Store', 'download.crdownload', 'x.tmp']) {
      assert.equal(isIgnoredEntry(noise), true, noise);
    }
    assert.equal(isIgnoredEntry('notes.pdf'), false);
  });
});
