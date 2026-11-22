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
