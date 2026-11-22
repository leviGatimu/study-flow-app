/**
 * The calm toolbar's pure helpers: YouTube link parsing (the only thing that
 * reaches an iframe URL), breathing phases, note clamping, storage validation.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  BREATH_PATTERNS,
  breathPhase,
  clampNote,
  parseYouTubeId,
  readScratchNotes,
  youTubeEmbedUrl,
} from '../lib/calm-tools.ts';

describe('parseYouTubeId', () => {
  const id = 'dQw4w9WgXcQ';
  for (const link of [
    `https://www.youtube.com/watch?v=${id}`,
    `https://www.youtube.com/watch?v=${id}&list=PL123&t=42s`,
    `youtube.com/watch?v=${id}`,
    `https://m.youtube.com/watch?v=${id}`,
    `https://music.youtube.com/watch?v=${id}`,
    `https://youtu.be/${id}`,
    `https://youtu.be/${id}?si=abc`,
    `https://www.youtube.com/shorts/${id}`,
    `https://www.youtube.com/embed/${id}`,
    `https://www.youtube-nocookie.com/embed/${id}`,
    `https://www.youtube.com/live/${id}`,
    `  ${id}  `,
  ]) {
    test(`reads ${link.trim()}`, () => assert.equal(parseYouTubeId(link), id));
  }

  for (const bad of [
    '',
    'hello',
    'https://vimeo.com/123456',
    `https://evil.com/watch?v=${id}`,
    `https://youtube.com.evil.com/watch?v=${id}`,
    'https://www.youtube.com/watch?v=short',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ"><script>',
    `javascript:alert(1)//youtu.be/${id}`,
    'https://www.youtube.com/channel/UC1234567890',
  ]) {
    test(`rejects ${JSON.stringify(bad)}`, () => assert.equal(parseYouTubeId(bad), null));
  }

  test('embed URL loops the one video and only carries the id', () => {
    const url = new URL(youTubeEmbedUrl(id, 'http://localhost:3000'));
    assert.equal(url.hostname, 'www.youtube-nocookie.com');
    assert.equal(url.pathname, `/embed/${id}`);
    assert.equal(url.searchParams.get('loop'), '1');
    assert.equal(url.searchParams.get('playlist'), id);
    assert.equal(url.searchParams.get('enablejsapi'), '1');
  });
});

describe('breathPhase', () => {
  const [calm, box] = BREATH_PATTERNS;

  test('starts breathing in, smallest, 4 seconds left', () => {
    const s = breathPhase(calm, 0);
    assert.equal(s.step.label, 'Breathe in');
    assert.equal(s.secondsLeft, 4);
    assert.equal(s.size, 0);
    assert.equal(s.rounds, 0);
  });

  test('a hold after breathing in stays full size', () => {
    const s = breathPhase(calm, 4000);
    assert.equal(s.step.label, 'Hold');
    assert.equal(s.size, 1);
    assert.equal(s.secondsLeft, 4);
  });

  test('breathing out shrinks and counts down', () => {
    const s = breathPhase(calm, 8000 + 3000);
    assert.equal(s.step.label, 'Breathe out');
    assert.equal(s.secondsLeft, 3);
    assert.ok(Math.abs(s.size - 0.5) < 1e-9);
  });

  test('wraps into the next round', () => {
    const s = breathPhase(calm, 14000 * 2 + 500);
    assert.equal(s.rounds, 2);
    assert.equal(s.step.label, 'Breathe in');
  });

  test('box breathing: the last hold stays small', () => {
    const s = breathPhase(box, 12000 + 1000);
    assert.equal(s.stepIndex, 3);
    assert.equal(s.step.label, 'Hold');
    assert.equal(s.size, 0);
  });

  test('negative time is treated as the start', () => {
    assert.equal(breathPhase(calm, -500).step.label, 'Breathe in');
  });
});

describe('clampNote', () => {
  const viewport = { width: 1000, height: 800 };
  const size = { width: 200, height: 200 };
  test('keeps a note inside the window', () => {
    assert.deepEqual(clampNote({ x: -50, y: 2000 }, viewport, size), { x: 8, y: 592 });
    assert.deepEqual(clampNote({ x: 5000, y: -10 }, viewport, size), { x: 792, y: 8 });
    assert.deepEqual(clampNote({ x: 300, y: 300 }, viewport, size), { x: 300, y: 300 });
  });
  test('a window smaller than the note pins it to the top-left margin', () => {
    assert.deepEqual(clampNote({ x: 100, y: 100 }, { width: 150, height: 150 }, size), { x: 8, y: 8 });
  });
});

describe('storage validation', () => {
  test('drops malformed notes and unknown colours become yellow', () => {
    const notes = readScratchNotes([
      { id: 'a', text: 'hi', color: '#bfdbfe', x: 1, y: 2, pinned: true, page: '/' },
      { id: 'b', text: 'x', color: 'red;background:url(x)', x: 1, y: 2, pinned: false, page: '/' },
      { id: 'c', text: 'no position' },
      null,
    ]);
    assert.equal(notes.length, 2);
    assert.equal(notes[1].color, '#fef08a');
  });
  test('not an array -> empty', () => {
    assert.deepEqual(readScratchNotes({}), []);
  });
});
