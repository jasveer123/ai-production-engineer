export type FieldOp = 'eq' | 'contains' | 'exists' | 'gt' | 'gte' | 'lt' | 'lte';

export type QueryNode =
  | { type: 'text'; value: string; negate: boolean }
  | { type: 'field'; key: string; op: FieldOp; values: string[]; negate: boolean };

export class QuerySyntaxError extends Error {
  constructor(
    message: string,
    readonly position: number,
  ) {
    super(message);
  }
}

const MAX_TERMS = 40;
const MAX_VALUE = 300;
const KEY_CHAR = /[A-Za-z0-9_.@/-]/;
const OPERATORS: [string, FieldOp, boolean][] = [
  ['!=', 'eq', true],
  ['>=', 'gte', false],
  ['<=', 'lte', false],
  [':', 'eq', false],
  ['=', 'eq', false],
  ['~', 'contains', false],
  ['>', 'gt', false],
  ['<', 'lt', false],
];
const NUMERIC_OPS = new Set<FieldOp>(['gt', 'gte', 'lt', 'lte']);

class Reader {
  pos = 0;
  constructor(readonly src: string) {}
  get done() {
    return this.pos >= this.src.length;
  }
  peek(n = 0) {
    return this.src[this.pos + n] ?? '';
  }
  skipSpace() {
    while (!this.done && /\s/.test(this.peek())) this.pos++;
  }
  quoted(): string {
    const start = this.pos++;
    let out = '';
    while (!this.done) {
      const c = this.src[this.pos++]!;
      if (c === '"') return out;
      if (c === '\\' && !this.done) out += this.src[this.pos++];
      else out += c;
    }
    throw new QuerySyntaxError('Unclosed quote', start);
  }
  bare(): string {
    const start = this.pos;
    while (!this.done && !/\s/.test(this.peek())) this.pos++;
    return this.src.slice(start, this.pos);
  }
  value(): string {
    return this.peek() === '"' ? this.quoted() : this.bare();
  }
}

function readOperator(r: Reader): { op: FieldOp; negate: boolean } | null {
  for (const [token, op, negate] of OPERATORS) {
    if (r.src.startsWith(token, r.pos)) {
      r.pos += token.length;
      return { op, negate };
    }
  }
  return null;
}

function checkLength(value: string, at: number): string {
  if (value.length > MAX_VALUE) throw new QuerySyntaxError('Value is too long', at);
  return value;
}

function readNegation(r: Reader): boolean {
  if (r.peek() !== '-' || !r.peek(1) || /\s/.test(r.peek(1))) return false;
  r.pos++;
  return true;
}

function readTerm(r: Reader): QueryNode {
  const start = r.pos;
  const negate = readNegation(r);
  if (r.peek() === '"') return { type: 'text', value: checkLength(r.quoted(), start), negate };

  const keyStart = r.pos;
  while (!r.done && KEY_CHAR.test(r.peek())) r.pos++;
  const key = r.src.slice(keyStart, r.pos);
  const operator = key && /^[A-Za-z_@]/.test(key) ? readOperator(r) : null;
  if (!operator) {
    r.pos = keyStart;
    return { type: 'text', value: checkLength(r.bare(), start), negate };
  }
  const valueAt = r.pos;
  const raw = checkLength(r.value(), valueAt);
  if (!raw) throw new QuerySyntaxError(`Missing value for ${key}`, valueAt);
  const field = {
    type: 'field' as const,
    key: key.toLowerCase(),
    negate: negate !== operator.negate,
  };
  if (operator.op === 'eq' && raw === '*') return { ...field, op: 'exists', values: [] };
  if (NUMERIC_OPS.has(operator.op) && !Number.isFinite(Number(raw)))
    throw new QuerySyntaxError(`${key} needs a number`, valueAt);
  const values = operator.op === 'eq' ? raw.split(',').filter(Boolean) : [raw];
  return { ...field, op: operator.op, values };
}

export function parseQuery(input: string): QueryNode[] {
  const r = new Reader(input);
  const nodes: QueryNode[] = [];
  for (r.skipSpace(); !r.done; r.skipSpace()) {
    nodes.push(readTerm(r));
    if (nodes.length > MAX_TERMS) throw new QuerySyntaxError('Too many terms', r.pos);
  }
  return nodes;
}
