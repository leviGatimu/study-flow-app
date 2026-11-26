import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { isMentorPath } from '../lib/mentor-header.ts';

describe('mentor page rules', () => {
  test('a mentor stays inside their own section', () => {
    for (const path of ['/mentor', '/mentor/schedule', '/mentor/reports', '/mentor/subjects']) {
      assert.equal(isMentorPath(path), true, path);
    }
  });

  test('every student page is outside it, including look-alike names', () => {
    for (const path of ['/', '/timetable', '/history', '/summaries', '/settings', '/ai', '/focus', '/mentors', '/mentorx', '/x/mentor']) {
      assert.equal(isMentorPath(path), false, path);
    }
  });
});
