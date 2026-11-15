import { sql, type SQL } from 'drizzle-orm';
import type { QueryNode } from '../domain/query-language';

export type FieldKind = 'text' | 'number' | 'level' | 'status';

export interface FieldTarget {
  column: SQL;
  kind: FieldKind;
}

export interface QuerySchema {
  fields: Record<string, FieldTarget>;
  attributes: SQL;
  text: SQL;
}

const LEVEL_ALIASES: Record<string, string> = { warning: 'warn', err: 'error', critical: 'fatal' };
const STATUS_ALIASES: Record<string, number> = { unset: 0, ok: 1, error: 2 };
const NUMERIC = /^-?\d+(\.\d+)?$/;

export const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

const contains = (column: SQL, value: string) =>
  sql`${column} ilike ${`%${likeEscape(value)}%`} escape '\\'`;

function attribute(schema: QuerySchema, key: string): SQL {
  return sql`coalesce(${schema.attributes} ->> ${key}, ${schema.attributes} #>> string_to_array(${key}, '.'))`;
}

function equals(target: FieldTarget, values: string[]): SQL {
  if (target.kind === 'number')
    return sql`${target.column} in (${sql.join(
      values.map((v) => sql`${Number(v)}`),
      sql`, `,
    )})`;
  if (target.kind === 'status')
    return sql`${target.column} in (${sql.join(
      values.map((v) => sql`${STATUS_ALIASES[v.toLowerCase()] ?? Number(v)}`),
      sql`, `,
    )})`;
  const normal = values.map((v) => {
    const lower = v.toLowerCase();
    return target.kind === 'level' ? (LEVEL_ALIASES[lower] ?? lower) : lower;
  });
  return sql`lower(${target.column}) in (${sql.join(
    normal.map((v) => sql`${v}`),
    sql`, `,
  )})`;
}

const COMPARE: Record<string, SQL> = {
  gt: sql.raw('>'),
  gte: sql.raw('>='),
  lt: sql.raw('<'),
  lte: sql.raw('<='),
};

function fieldExpr(schema: QuerySchema, node: Extract<QueryNode, { type: 'field' }>): SQL {
  const target = schema.fields[node.key];
  const column = target?.column ?? attribute(schema, node.key);
  switch (node.op) {
    case 'exists':
      return sql`${column} is not null`;
    case 'contains':
      return contains(sql`${column}::text`, node.values[0]!);
    case 'eq':
      return target
        ? equals(target, node.values)
        : sql`lower(${column}) in (${sql.join(
            node.values.map((v) => sql`${v.toLowerCase()}`),
            sql`, `,
          )})`;
    default: {
      const numeric =
        target && target.kind !== 'text'
          ? sql`${column}`
          : sql`(case when ${column} ~ ${NUMERIC.source} then (${column})::numeric end)`;
      return sql`${numeric} ${COMPARE[node.op]!} ${Number(node.values[0])}`;
    }
  }
}

export function compileQuery(nodes: QueryNode[], schema: QuerySchema): SQL[] {
  return nodes.map((node) => {
    const expr = node.type === 'text' ? contains(schema.text, node.value) : fieldExpr(schema, node);
    return node.negate ? sql`not coalesce(${expr}, false)` : sql`(${expr})`;
  });
}
