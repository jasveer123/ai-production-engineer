import assert from 'node:assert/strict';
import { test } from 'vitest';
import { repoOptions, serviceNamesFor, suggestRepo } from './repo-options.ts';

test('dedupes and sorts connected repositories', () => {
  assert.deepEqual(repoOptions(['me/shop', 'me/app', 'me/shop'], null), ['me/app', 'me/shop']);
});

test('keeps the current repository even when it is no longer connected', () => {
  assert.deepEqual(repoOptions(['me/app'], 'old/repo'), ['me/app', 'old/repo']);
  assert.deepEqual(repoOptions(['me/app'], 'me/app'), ['me/app']);
});

test('suggests a repository only when exactly one name matches', () => {
  const repos = ['me/demo-shop', 'me/portfolio'];
  assert.equal(suggestRepo('demo-shop-api', repos), 'me/demo-shop');
  assert.equal(suggestRepo('Portfolio', repos), 'me/portfolio');
  assert.equal(suggestRepo('payments', repos), null);
  assert.equal(suggestRepo('shop-api', ['me/shop', 'other/shop']), null);
  assert.equal(suggestRepo('demo', ['me/demo-shop', 'me/demo-blog']), null);
});

test('service names for a repository: linked, then telemetry, then repo name, then the rest', () => {
  const repos = ['me/demo-shop', 'me/portfolio'];
  const mapped = [{ name: 'shop-web', repositoryFullName: 'me/demo-shop' }];
  assert.deepEqual(serviceNamesFor('me/demo-shop', mapped, ['demo-shop-api', 'payments'], repos), [
    'shop-web',
    'demo-shop-api',
    'demo-shop',
    'payments',
  ]);
  assert.equal(serviceNamesFor('me/portfolio', mapped, [], repos)[0], 'portfolio');
});
