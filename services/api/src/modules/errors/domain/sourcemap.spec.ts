import { parseSourceMap, symbolicateFrame } from './sourcemap';

const MAP = JSON.stringify({
  version: 3,
  sources: ['src/price.ts'],
  names: ['computePrice'],
  mappings: 'AAAA,SAASA',
});

describe('source maps', () => {
  it('maps a minified frame back to the original file, line and name', () => {
    const map = parseSourceMap(MAP);
    const frame = symbolicateFrame('    at a (https://cdn.test/app.min.js:1:10)', () => map);
    expect(frame).toBe('    at computePrice (src/price.ts:1:10)');
  });

  it('leaves frames it cannot map and rejects bad maps', () => {
    const map = parseSourceMap(MAP);
    expect(symbolicateFrame('    at a (other.js:5:1)', () => null)).toBeNull();
    expect(symbolicateFrame('not a frame', () => map)).toBeNull();
    expect(() => parseSourceMap('{"hello":1}')).toThrow();
  });
});
