/** Sharing Resources as a zip: the zip itself, and how a zip becomes folders, files and links. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';

import { crc32, makeZip, readZip } from '../lib/zip.ts';
import { buildManifest, cleanFolder, mimeOf, PACK_MANIFEST, planImport, uploadBatches } from '../lib/resource-pack.ts';

const enc = (s) => new TextEncoder().encode(s);
const dec = (b) => new TextDecoder().decode(b);

/** A zip whose entries are deflated, the way Windows "Compress" and most tools make them. */
function deflatedZip(files) {
  const parts = [];
  const central = [];
  let offset = 0;
  for (const [path, text] of files) {
    const name = enc(path);
    const data = enc(text);
    const packed = deflateRawSync(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc32(data), 14);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0);
    dir.writeUInt16LE(0x0800, 8);
    dir.writeUInt16LE(8, 10);
    dir.writeUInt32LE(crc32(data), 16);
    dir.writeUInt32LE(packed.length, 20);
    dir.writeUInt32LE(data.length, 24);
    dir.writeUInt16LE(name.length, 28);
    dir.writeUInt32LE(offset, 42);
    parts.push(local, name, packed);
    central.push(dir, name);
    offset += 30 + name.length + packed.length;
  }
  const size = central.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(size, 12);
  end.writeUInt32LE(offset, 16);
  const all = Buffer.concat([...parts, ...central, end]);
  return all.buffer.slice(all.byteOffset, all.byteOffset + all.length);
}

test('crc32 matches the standard check value', () => {
  assert.equal(crc32(enc('123456789')), 0xcbf43926);
});

test('a zip we make reads back the same, names in any language included', async () => {
  const entries = [
    { path: PACK_MANIFEST, data: enc('{"kind":"x"}') },
    { path: 'Chapter 1/Notes é.pdf', data: enc('%PDF-1.7 fake') },
    { path: 'Empty.txt', data: new Uint8Array(0) },
  ];
  const blob = makeZip(entries, new Date(2026, 10, 24, 10, 30));
  const back = await readZip(await blob.arrayBuffer());
  assert.deepEqual(back.map((e) => e.path), entries.map((e) => e.path));
  assert.equal(dec(back[1].data), '%PDF-1.7 fake');
  assert.equal(back[2].data.length, 0);
});

test('a compressed zip from another tool opens, and its folder entries are skipped', async () => {
  const zip = deflatedZip([
    ['Physics/', ''],
    ['Physics/Waves/summary.txt', 'Waves carry energy. '.repeat(50)],
  ]);
  const back = await readZip(zip);
  assert.deepEqual(back.map((e) => e.path), ['Physics/Waves/summary.txt']);
  assert.equal(dec(back[0].data), 'Waves carry energy. '.repeat(50));
});

test('not a zip, and too many entries, are refused in words', async () => {
  await assert.rejects(readZip(enc('hello, not a zip at all').buffer), /not a zip/);
  const blob = makeZip([{ path: 'a.txt', data: enc('a') }, { path: 'b.txt', data: enc('b') }]);
  await assert.rejects(readZip(await blob.arrayBuffer(), { maxEntries: 1, maxBytes: 100 }), /at most 1/);
});

test('our share: folders, files and links come back where they were', () => {
  const manifest = buildManifest({
    subject: 'Physics',
    from: 'Levi',
    folders: ['Chapter 1', 'Chapter 1/Worksheets', 'Empty one'],
    links: [{ title: 'Khan Academy', url: 'https://khanacademy.org', folder: 'Chapter 1' }],
  });
  const plan = planImport(
    [
      { path: PACK_MANIFEST, size: 10 },
      { path: 'Syllabus.pdf', size: 100 },
      { path: 'Chapter 1/Worksheets/Sheet 1.docx', size: 200 },
    ],
    JSON.stringify(manifest)
  );
  assert.equal(plan.from, 'Levi');
  assert.equal(plan.subject, 'Physics');
  assert.deepEqual(plan.folders, ['Chapter 1', 'Empty one', 'Chapter 1/Worksheets']);
  assert.deepEqual(
    plan.files.map((f) => [f.folder, f.name]),
    [['', 'Syllabus.pdf'], ['Chapter 1/Worksheets', 'Sheet 1.docx']]
  );
  assert.deepEqual(plan.links, [{ title: 'Khan Academy', url: 'https://khanacademy.org', folder: 'Chapter 1' }]);
  assert.deepEqual(plan.skipped, []);
});

test('a plain zip of one folder: that folder is the subject, not a folder inside it', () => {
  const plan = planImport(
    [
      { path: 'Maths/Algebra/notes.pdf', size: 1 },
      { path: 'Maths/past paper.pdf', size: 1 },
      { path: 'Maths/.DS_Store', size: 1 },
      { path: '__MACOSX/Maths/._notes.pdf', size: 1 },
    ],
    null
  );
  assert.equal(plan.subject, 'Maths');
  assert.equal(plan.from, null);
  assert.deepEqual(plan.folders, ['Algebra']);
  assert.deepEqual(plan.files.map((f) => `${f.folder}|${f.name}|${f.zipPath}`), ['Algebra|notes.pdf|Maths/Algebra/notes.pdf', '|past paper.pdf|Maths/past paper.pdf']);
  assert.match(plan.skipped.join(' '), /2 system files left out/);
});

test('nothing can climb out of the subject, and only web links come in', () => {
  assert.equal(cleanFolder('../../Windows'), null);
  assert.equal(cleanFolder('a/../b'), null);
  assert.equal(cleanFolder('Chapter 1//Notes:draft'), 'Chapter 1/Notes draft');
  const manifest = buildManifest({
    subject: 'x',
    from: null,
    folders: ['../evil'],
    links: [
      { title: 'bad', url: 'javascript:alert(1)', folder: '' },
      { title: 'file', url: 'file:///C:/secret', folder: '' },
      { title: 'ok', url: 'https://example.com', folder: '' },
    ],
  });
  const plan = planImport([{ path: '../outside.pdf', size: 1 }, { path: 'in.pdf', size: 1 }], JSON.stringify(manifest));
  assert.deepEqual(plan.files.map((f) => f.name), ['in.pdf']);
  assert.deepEqual(plan.folders, []);
  assert.deepEqual(plan.links.map((l) => l.title), ['ok']);
  assert.match(plan.skipped.join(' '), /2 links left out/);
});

test('a share from a newer app still brings its files, and says so', () => {
  const plan = planImport([{ path: 'a.pdf', size: 1 }], JSON.stringify({ kind: 'study-flow-resources', version: 99, links: [] }));
  assert.equal(plan.files.length, 1);
  assert.match(plan.skipped[0], /newer version/);
});

test('uploads go in small batches, one folder per batch', () => {
  const f = (folder, size) => ({ zipPath: '', folder, name: 'n', size });
  const batches = uploadBatches([f('', 10), f('', 10), f('', 10), f('A', 5), f('', 50)], 2, 30);
  assert.deepEqual(batches.map((b) => b.map((x) => `${x.folder}${x.size}`)), [['10', '10'], ['10'], ['50'], ['A5']]);
});

test('file types come from the extension', () => {
  assert.equal(mimeOf('Notes.PDF'), 'application/pdf');
  assert.equal(mimeOf('slides.pptx'), 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
  assert.equal(mimeOf('README'), '');
});
