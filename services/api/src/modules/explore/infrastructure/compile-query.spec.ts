import { and } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { parseQuery } from '../domain/query-language';
import { compileQuery } from './compile-query';
import { LOG_SCHEMA, SPAN_SCHEMA } from './query-schemas';

const dialect = new PgDialect();
const render = (q: string, schema = LOG_SCHEMA) =>
  dialect.sqlToQuery(and(...compileQuery(parseQuery(q), schema))!);

describe('compileQuery', () => {
  it('binds every user value as a parameter', () => {
    const { sql, params } = render(`service:"x'; drop table logs;--" "50%_off\\\\"`);
    expect(sql).not.toContain('drop table');
    expect(sql).not.toContain('50%');
    expect(params).toContain("x'; drop table logs;--");
    expect(params).toContain('%50\\%\\_off\\\\%');
  });

  it('maps levels, negation and attribute keys', () => {
    const { sql, params } = render('level:warning -path:/health status>=500');
    expect(sql).toContain('lower("log_records"."level") in ($1)');
    expect(params[0]).toBe('warn');
    expect(sql).toContain('not coalesce(');
    expect(sql).toContain('"log_records"."attributes" ->> $2');
    expect(params).toContain('path');
    expect(params).toContain(500);
    expect(sql).toContain('::numeric end) >= $');
  });

  it('keeps attribute keys out of the SQL text', () => {
    const { sql, params } = render('a.b:*');
    expect(sql).not.toContain('a.b');
    expect(params).toEqual(['a.b', 'a.b']);
    expect(sql).toContain('is not null');
  });

  it('compiles span status and duration as typed columns', () => {
    const { sql, params } = render('status:error duration>250 operation~GET', SPAN_SCHEMA);
    expect(sql).toContain('"spans"."status_code" in ($1)');
    expect(params[0]).toBe(2);
    expect(sql).toContain('"spans"."duration_ms" > $2');
    expect(params[2]).toBe('%GET%');
  });
});
