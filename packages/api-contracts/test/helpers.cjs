const assert = require('node:assert/strict');

const ok = (schema, value) => assert.equal(schema.safeParse(value).success, true);
const bad = (schema, value) => assert.equal(schema.safeParse(value).success, false);
const parse = (schema, value) => schema.parse(value);
const UUID = '123e4567-e89b-42d3-a456-426614174000';
const NOW = '2026-01-01T00:00:00.000Z';

module.exports = { ok, bad, parse, UUID, NOW, c: require('../dist') };
