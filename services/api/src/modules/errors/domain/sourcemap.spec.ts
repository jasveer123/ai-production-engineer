import { mapFrame, parseSourceMap, symbolicateFrame } from './sourcemap';

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

describe('structured frame mapping', () => {
  const withSource = parseSourceMap(
    JSON.stringify({
      version: 3,
      sources: ['src/price.ts'],
      names: ['computePrice'],
      mappings: ';AACA,SAASA',
      sourcesContent: ['// header\nexport function computePrice() {\n  return 1;\n}'],
    }),
  );
  const frame = {
    function: 'a',
    file: 'https://cdn.test/app.min.js?v=1',
    line: 2,
    column: 10,
    inApp: true,
    context: null,
    mapped: false,
  };

  it('returns the original position with code context', () => {
    const mapped = mapFrame(frame, (file) => (file === 'app.min.js' ? withSource : null));
    expect(mapped).toMatchObject({
      function: 'computePrice',
      file: 'src/price.ts',
      line: 2,
      mapped: true,
    });
    expect(mapped.context?.line).toBe('export function computePrice() {');
    expect(mapped.context?.pre).toEqual(['// header']);
  });

  it('keeps the original frame when no map matches', () => {
    expect(mapFrame(frame, () => null)).toBe(frame);
  });
});
