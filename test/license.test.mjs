import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('ships the complete Apache 2.0 license and Blackscale copyright notice', () => {
  const root = new URL('../', import.meta.url);
  const license = readFileSync(new URL('LICENSE', root), 'utf8').replace(/\r\n/g, '\n');
  assert.equal(createHash('sha256').update(license).digest('hex'),
    '5c9817c129b98e7bb966bca028c43c19107102ef8e03fe799bffb4354f4ef015');
  assert.match(readFileSync(new URL('NOTICE', root), 'utf8'), /Copyright 2026 Blackscale/);
  const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));
  assert.equal(pkg.license, 'Apache-2.0');
  assert.ok(pkg.files.includes('LICENSE'));
  assert.ok(pkg.files.includes('NOTICE'));
});
