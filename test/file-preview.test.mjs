import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { isSafeDocumentHref, modernFormatFor, parseCsv, previewKind } from '../lib/file-preview.ts';

describe('file preview', () => {
  test('each Office format has a viewer; the pre-2007 ones are named, not guessed', () => {
    assert.equal(previewKind('docx'), 'docx');
    assert.equal(previewKind('.PPTX'), 'pptx');
    assert.equal(previewKind('xlsx'), 'xlsx');
    assert.equal(previewKind('csv'), 'csv');
    assert.equal(previewKind('md'), 'text');
    for (const old of ['doc', 'ppt', 'xls']) assert.equal(previewKind(old), 'legacy-office');
    assert.equal(previewKind('exe'), 'none');
    assert.deepEqual(modernFormatFor('ppt'), { app: 'PowerPoint', ext: 'pptx' });
    assert.equal(modernFormatFor('pdf'), null);
  });

  test('CSV: quotes, doubled quotes, line breaks inside quotes, CRLF, BOM, row cap', () => {
    assert.deepEqual(parseCsv('\uFEFFa,b\r\n"x, y","he said ""hi"""\n"two\nlines",3'), [
      ['a', 'b'],
      ['x, y', 'he said "hi"'],
      ['two\nlines', '3'],
    ]);
    assert.equal(parseCsv('1\n2\n3\n4', 2).length, 2);
    assert.deepEqual(parseCsv(''), []);
  });

  test('only http(s), mailto and in-page links stay clickable in a document', () => {
    for (const ok of ['https://a.b', 'http://a.b', 'mailto:x@y.z', '#section']) {
      assert.ok(isSafeDocumentHref(ok), ok);
    }
    const bad = ['java' + 'script:alert(1)', ' Java' + 'Script:alert(1)', 'data:text/html,x', 'file:///c:/x', '', null];
    for (const href of bad) {
      assert.equal(isSafeDocumentHref(href), false, String(href));
    }
  });
});

test('saved links open at an address that can sit inside the app', async () => {
  const { linkEmbedUrl } = await import('../lib/file-preview.ts');
  assert.equal(linkEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10'), 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0');
  assert.equal(linkEmbedUrl('https://youtu.be/dQw4w9WgXcQ'), 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0');
  assert.equal(linkEmbedUrl('https://docs.google.com/document/d/abc_123/edit?usp=sharing'), 'https://docs.google.com/document/d/abc_123/preview');
  assert.equal(linkEmbedUrl('https://docs.google.com/presentation/d/XYZ/edit#slide=id.p'), 'https://docs.google.com/presentation/d/XYZ/preview');
  assert.equal(linkEmbedUrl('https://drive.google.com/file/d/FILEID/view?usp=drive_link'), 'https://drive.google.com/file/d/FILEID/preview');
  assert.equal(linkEmbedUrl('https://en.wikipedia.org/wiki/Physics'), 'https://en.wikipedia.org/wiki/Physics');
  assert.equal(linkEmbedUrl('javascript:alert(1)'), null);
  assert.equal(linkEmbedUrl('file:///C:/secret.txt'), null);
  assert.equal(linkEmbedUrl('not a link'), null);
});
