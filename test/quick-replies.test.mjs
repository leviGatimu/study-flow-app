/** Small talk in the Study chat is answered without a request to the AI. */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { normalise, quickReply } from '../lib/quick-replies.ts';

test('greetings, thanks, goodbyes and "ok" get a ready reply', () => {
  for (const m of ['hello', 'Hello hello', 'hiiii', 'HEY!!', 'hey 👋', 'good morning', 'how are you?', 'Thanks!', 'thank you so much', 'ok', 'okkk', 'got it', 'bye', 'what can you do?', "what's up"]) {
    assert.ok(quickReply(m), `no ready reply for "${m}"`);
  }
});

test('anything with a real question goes to the AI', () => {
  for (const m of ['hello, explain recursion', 'hi can you quiz me on physics', 'thanks, now make a practice set', 'ok what is due tomorrow', 'help me with maths', 'what is a pointer', '']) {
    assert.equal(quickReply(m), null, `"${m}" should go to the AI`);
  }
});

test('the same request always gets the same wording', () => {
  assert.equal(quickReply('hello', 'req-1'), quickReply('hello', 'req-1'));
});

test('normalise drops punctuation and says a repeated word once', () => {
  assert.equal(normalise('Hello, hello!!  HELLO'), 'hello');
  assert.equal(normalise("What's up?"), 'whats up');
});
