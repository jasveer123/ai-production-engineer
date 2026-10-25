import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  formatCount,
  formatDateTime,
  formatDuration,
  formatElapsed,
  formatInr,
  formatInrCompact,
  formatLogTime,
  formatPeople,
  formatPercent,
  formatUsd,
} from './format.ts';

test('formatCount groups thousands', () => {
  assert.equal(formatCount(1284), '1,284');
  assert.equal(formatCount(0), '0');
});

test('formatPercent rounds fractions and guards bad input', () => {
  assert.equal(formatPercent(0.4231), '42%');
  assert.equal(formatPercent(0.4231, 1), '42.3%');
  assert.equal(formatPercent(Number.NaN), '—');
});

test('formatUsd shows two decimals', () => {
  assert.equal(formatUsd(1.8), '$1.80');
  assert.equal(formatUsd(Number.POSITIVE_INFINITY), '—');
});

test('formatDuration picks a readable unit', () => {
  assert.equal(formatDuration(840), '840 ms');
  assert.equal(formatDuration(4200), '4.2 s');
  assert.equal(formatDuration(42_000), '42 s');
  assert.equal(formatDuration(180_000), '3 min');
  assert.equal(formatDuration(3_900_000), '1 h 5 min');
  assert.equal(formatDuration(7_200_000), '2 h');
  assert.equal(formatDuration(-1), '—');
});

test('date formatting is UTC and rejects invalid input', () => {
  assert.equal(formatDateTime('2026-10-20T10:42:07.143Z'), 'Oct 20, 10:42');
  assert.equal(formatLogTime('2026-10-20T10:42:07.143Z'), '10:42:07.143');
  assert.equal(formatDateTime('not a date'), '—');
  assert.equal(formatLogTime('not a date'), '—');
});

test('formatElapsed measures between two timestamps', () => {
  assert.equal(formatElapsed('2026-10-20T10:00:00Z', '2026-10-20T10:12:00Z'), '12 min');
});

test('formatInr uses Indian grouping', () => {
  assert.equal(formatInr(185000), '₹1,85,000');
  assert.equal(formatInr(Number.NaN), '—');
});

test('formatInrCompact shortens to K, L and Cr', () => {
  assert.equal(formatInrCompact(4500), '₹4.5K');
  assert.equal(formatInrCompact(760000), '₹7.6L');
  assert.equal(formatInrCompact(1_500_000), '₹15L');
  assert.equal(formatInrCompact(32_000_000), '₹3.2Cr');
  assert.equal(formatInrCompact(900), '₹900');
  assert.equal(formatInrCompact(200000), '₹2L');
});

test('formatPeople uses singular and plural', () => {
  assert.equal(formatPeople(1), '1 person');
  assert.equal(formatPeople(0), '0 people');
  assert.equal(formatPeople(1240), '1,240 people');
});
