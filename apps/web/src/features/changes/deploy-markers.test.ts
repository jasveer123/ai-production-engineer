import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Deployment, RepoCommit } from '@ape/api-contracts';
import { markCommits, sameSha } from './deploy-markers.ts';

const commit = (sha: string): RepoCommit => ({
  sha,
  message: sha,
  author: null,
  date: null,
  url: '',
});
const deploy = (commitSha: string): Deployment => ({
  id: commitSha,
  serviceId: null,
  serviceName: 'api',
  environment: 'production',
  commitSha,
  version: null,
  deployedAt: '2026-10-20T10:00:00Z',
  integrationName: null,
});

test('matches full and short SHAs, but never on fewer than 7 characters', () => {
  assert.equal(sameSha('abcdef1234567890', 'ABCDEF1'), true);
  assert.equal(sameSha('abcdef1', 'abcdef1234'), true);
  assert.equal(sameSha('abcdef1234', 'abc'), false);
  assert.equal(sameSha('abcdef1234', 'abcdef2'), false);
});

test('marks newer commits pending, the live one, and older ones shipped', () => {
  const commits = ['c3c3c3c3', 'c2c2c2c2', 'c1c1c1c1'].map(commit);
  const marked = markCommits(commits, [deploy('c2c2c2c'), deploy('c1c1c1c1')]);
  assert.deepEqual(
    marked.map((m) => [m.state, m.deploys.length]),
    [
      ['pending', 0],
      ['live', 1],
      ['shipped', 1],
    ],
  );
});

test('says unknown instead of guessing when the live deploy is not among the commits', () => {
  const marked = markCommits([commit('c1c1c1c1')], [deploy('ffffffff')]);
  assert.equal(marked[0]!.state, 'unknown');
  assert.equal(markCommits([commit('c1c1c1c1')], [])[0]!.state, 'unknown');
});
