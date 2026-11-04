import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankGeminiModels, isModelUnavailableError, describeAIFailure, rankOpenAIModels } from '../lib/ai-models.ts';

const gen = ['generateContent', 'countTokens'];
const listing = [
  { name: 'models/gemini-2.5-pro', supportedGenerationMethods: gen },
  { name: 'models/embedding-001', supportedGenerationMethods: ['embedContent'] },
  { name: 'models/gemini-embedding-001', supportedGenerationMethods: ['embedContent'] },
  { name: 'models/gemini-2.5-flash', supportedGenerationMethods: gen },
  { name: 'models/gemini-3.1-pro-preview', supportedGenerationMethods: gen },
  { name: 'models/gemini-2.5-flash-preview-tts', supportedGenerationMethods: gen },
  { name: 'models/gemini-2.5-flash-lite', supportedGenerationMethods: gen },
  { name: 'models/gemini-flash-latest', supportedGenerationMethods: gen },
  { name: 'models/gemma-3-27b-it', supportedGenerationMethods: gen },
];

test('the first-listed retired model is no longer picked; aliases and stable Flash lead', () => {
  const ranked = rankGeminiModels(listing);
  assert.equal(ranked[0], 'gemini-flash-latest');
  assert.equal(ranked[1], 'gemini-2.5-flash');
  assert.ok(ranked.indexOf('gemini-2.5-flash') < ranked.indexOf('gemini-2.5-pro'));
  assert.ok(ranked.indexOf('gemini-2.5-pro') < ranked.indexOf('gemini-3.1-pro-preview'), 'stable before preview');
  assert.ok(ranked.indexOf('gemini-2.5-flash-lite') < ranked.indexOf('gemini-2.5-pro'), 'every non-Pro model before any Pro model');
});

test('non-chat models are dropped', () => {
  const ranked = rankGeminiModels(listing);
  for (const gone of ['embedding-001', 'gemini-embedding-001', 'gemini-2.5-flash-preview-tts', 'gemma-3-27b-it']) {
    assert.ok(!ranked.includes(gone), gone);
  }
});

test('a newer stable version outranks an older one, and empty listings stay empty', () => {
  assert.deepEqual(rankGeminiModels([{ name: 'models/gemini-2.5-flash' }, { name: 'models/gemini-3-flash' }]), ['gemini-3-flash', 'gemini-2.5-flash']);
  assert.deepEqual(rankGeminiModels([]), []);
});

test('retired and out-of-quota models are skipped; key errors are not', () => {
  assert.ok(isModelUnavailableError('[404 Not Found] This model models/gemini-2.5-pro is no longer available to new users.'));
  assert.ok(isModelUnavailableError('[429 Too Many Requests] You exceeded your current quota ... limit: 0, model: gemini-3.1-pro'));
  assert.ok(!isModelUnavailableError('[400 Bad Request] API key not valid.'));
});

test('failures are described in plain words', () => {
  assert.equal(describeAIFailure('gemini-pro-latest', '[429 Too Many Requests] quota exceeded'), 'gemini-pro-latest: no quota left on this key');
  assert.equal(describeAIFailure('gemini-2.5-pro', '[404 Not Found] no longer available'), 'gemini-2.5-pro: no longer offered by the provider');
  assert.equal(describeAIFailure('gpt-4o-mini', '401 Incorrect API key provided'), 'gpt-4o-mini: the key was rejected');
});

test('OpenAI picks a chat model, never image/audio/embedding ones', () => {
  const ids = ['dall-e-3', 'whisper-1', 'text-embedding-3-small', 'gpt-4o-mini-2024-07-18', 'gpt-4o-mini', 'gpt-4o-realtime-preview', 'gpt-image-1', 'gpt-5-mini', 'omni-moderation-latest'];
  const ranked = rankOpenAIModels(ids, ['gpt-4o-mini']);
  assert.equal(ranked[0], 'gpt-4o-mini');
  assert.deepEqual([...ranked].sort(), ['gpt-4o-mini', 'gpt-4o-mini-2024-07-18', 'gpt-5-mini']);
});
