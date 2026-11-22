/**
 * "Talk it out": instant greetings, the crisis check, request checking and
 * reading each provider's stream.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  geminiChunkText,
  mentionsCrisis,
  ollamaChunkText,
  openAIChunkText,
  quickTalkReply,
  readTalkMessages,
  streamLines,
  TALK_LIMITS,
} from '../lib/talk.ts';

describe('quickTalkReply', () => {
  for (const hi of ['wassup', 'Wassup!', 'yo', 'hey', "what's up", 'sup bro', 'Good morning']) {
    test(`answers "${hi}" at once`, () => assert.ok(quickTalkReply(hi)));
  }
  for (const real of ['wassup, I failed my exam', 'hey I feel bad', 'I am tired', '']) {
    test(`sends "${real}" to the AI`, () => assert.equal(quickTalkReply(real), null));
  }
  test('wording changes with the seed', () => assert.notEqual(quickTalkReply('hi', 0), quickTalkReply('hi', 1)));
});

describe('mentionsCrisis', () => {
  for (const t of ['I want to kill myself', 'i wanna die', 'thinking about suicide', "I don't want to live anymore", 'everyone would be better off without me', 'I keep cutting myself', 'self-harm']) {
    test(`flags "${t}"`, () => assert.equal(mentionsCrisis(t), true));
  }
  for (const t of ['this exam is killing me', 'I could die of boredom lol', 'I hurt my leg at football', 'deadline is tomorrow']) {
    test(`does not flag "${t}"`, () => assert.equal(mentionsCrisis(t), false));
  }
});

describe('readTalkMessages', () => {
  test('keeps a well-formed chat that ends with the student', () => {
    const m = readTalkMessages([{ role: 'user', text: 'hi' }, { role: 'model', text: 'hey' }, { role: 'user', text: ' stressed ' }]);
    assert.deepEqual(m.at(-1), { role: 'user', text: 'stressed' });
  });
  test('drops a leading AI message (providers want the student first)', () => {
    const m = readTalkMessages([{ role: 'model', text: 'hey' }, { role: 'user', text: 'hi' }]);
    assert.deepEqual(m, [{ role: 'user', text: 'hi' }]);
  });
  test('refuses junk, unknown roles and a chat ending with the AI', () => {
    assert.equal(readTalkMessages(null), null);
    assert.equal(readTalkMessages([]), null);
    assert.equal(readTalkMessages([{ role: 'system', text: 'x' }]), null);
    assert.equal(readTalkMessages([{ role: 'user', text: 'hi' }, { role: 'model', text: 'hey' }]), null);
  });
  test('caps history and message length', () => {
    const many = Array.from({ length: 50 }, (_, i) => ({ role: i % 2 ? 'model' : 'user', text: 'x'.repeat(5000) }));
    many.push({ role: 'user', text: 'last' });
    const m = readTalkMessages(many);
    assert.ok(m.length <= TALK_LIMITS.history);
    assert.ok(m.every((x) => x.text.length <= TALK_LIMITS.messageChars));
  });
});

describe('stream readers', () => {
  test('Gemini SSE text, thoughts hidden', () => {
    const line = 'data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text: 'secret', thought: true }, { text: 'Hey' }] } }] });
    assert.equal(geminiChunkText(line), 'Hey');
    assert.equal(geminiChunkText(''), '');
    assert.equal(geminiChunkText('data: not json'), '');
  });
  test('OpenAI SSE delta and [DONE]', () => {
    assert.equal(openAIChunkText('data: ' + JSON.stringify({ choices: [{ delta: { content: 'Hi' } }] })), 'Hi');
    assert.equal(openAIChunkText('data: [DONE]'), '');
  });
  test('Ollama NDJSON', () => {
    assert.equal(ollamaChunkText(JSON.stringify({ message: { content: 'Yo' }, done: false })), 'Yo');
    assert.equal(ollamaChunkText('{broken'), '');
  });
  test('streamLines joins lines split across chunks', async () => {
    const enc = new TextEncoder();
    const body = new ReadableStream({
      start(c) {
        for (const part of ['data: a', 'b\r\nda', 'ta: c\n', 'tail']) c.enqueue(enc.encode(part));
        c.close();
      },
    });
    const lines = [];
    for await (const line of streamLines(body)) lines.push(line);
    assert.deepEqual(lines, ['data: ab', 'data: c', 'tail']);
  });
});
