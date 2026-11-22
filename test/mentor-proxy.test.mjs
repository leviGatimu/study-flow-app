import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { isMentorBlockedPath } from '../lib/mentor-header.ts';

describe('mentor page rules', () => {
  test('a mentor is kept out of settings, AI chat, focus and private areas', () => {
    for (const path of ['/settings', '/settings/x', '/ai', '/ai/practices', '/focus', '/focus/abc', '/profile', '/admin', '/setup', '/ask', '/projects/p1', '/notes']) {
      assert.equal(isMentorBlockedPath(path), true, path);
    }
  });

  test('every progress page stays open, including look-alike names', () => {
    for (const path of ['/', '/timetable', '/calendar', '/manage', '/school-timetable', '/history', '/history/abc', '/summaries', '/marks', '/streak', '/homeworks/x', '/exams', '/subjects', '/resources/Physics', '/year', '/aims', '/settingsx']) {
      assert.equal(isMentorBlockedPath(path), false, path);
    }
  });
});
