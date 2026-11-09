import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SITE_URL, SUPPORT_URL } from '../../src/core/site.ts';

test('the support page the extension links is a page of the site', () => {
  assert.ok(SUPPORT_URL.startsWith(`${SITE_URL}/`), `${SUPPORT_URL} is not under ${SITE_URL}`);
  assert.ok(!SITE_URL.endsWith('/'), 'SITE_URL ends in a slash, so paths built on it double it');
});
