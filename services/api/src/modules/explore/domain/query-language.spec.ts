import { parseQuery, QuerySyntaxError } from './query-language';

describe('parseQuery', () => {
  it('parses fields, phrases, comparisons and negation', () => {
    expect(parseQuery('level:error service:checkout "timeout" status>=500 -path:/health')).toEqual([
      { type: 'field', key: 'level', op: 'eq', values: ['error'], negate: false },
      { type: 'field', key: 'service', op: 'eq', values: ['checkout'], negate: false },
      { type: 'text', value: 'timeout', negate: false },
      { type: 'field', key: 'status', op: 'gte', values: ['500'], negate: false },
      { type: 'field', key: 'path', op: 'eq', values: ['/health'], negate: true },
    ]);
  });

  it('supports exists, contains, not-equal and value lists', () => {
    expect(parseQuery('user.id:* url~/api region!=eu level:warn,error')).toEqual([
      { type: 'field', key: 'user.id', op: 'exists', values: [], negate: false },
      { type: 'field', key: 'url', op: 'contains', values: ['/api'], negate: false },
      { type: 'field', key: 'region', op: 'eq', values: ['eu'], negate: true },
      { type: 'field', key: 'level', op: 'eq', values: ['warn', 'error'], negate: false },
    ]);
  });

  it('handles escaped quotes and quoted field values', () => {
    expect(parseQuery('msg:"a \\"b\\" c" "x\\\\y"')).toEqual([
      { type: 'field', key: 'msg', op: 'eq', values: ['a "b" c'], negate: false },
      { type: 'text', value: 'x\\y', negate: false },
    ]);
  });

  it('treats free words, paths and lone dashes as text', () => {
    expect(parseQuery('/health - foo')).toEqual([
      { type: 'text', value: '/health', negate: false },
      { type: 'text', value: '-', negate: false },
      { type: 'text', value: 'foo', negate: false },
    ]);
  });

  it('rejects bad input', () => {
    expect(() => parseQuery('"open')).toThrow(QuerySyntaxError);
    expect(() => parseQuery('status>=abc')).toThrow('status needs a number');
    expect(() => parseQuery('service:')).toThrow('Missing value');
    expect(() => parseQuery('a '.repeat(41))).toThrow('Too many terms');
  });

  it('returns nothing for an empty query', () => {
    expect(parseQuery('   ')).toEqual([]);
  });
});
