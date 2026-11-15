export class Writer {
  private chunks: number[] = [];

  private varintRaw(v: bigint): void {
    let x = BigInt.asUintN(64, v);
    while (x > 0x7fn) {
      this.chunks.push(Number((x & 0x7fn) | 0x80n));
      x >>= 7n;
    }
    this.chunks.push(Number(x));
  }
  private tag(field: number, wire: number) {
    this.varintRaw(BigInt((field << 3) | wire));
  }
  uint(field: number, v: number | bigint): this {
    this.tag(field, 0);
    this.varintRaw(BigInt(v));
    return this;
  }
  fixed64(field: number, v: bigint): this {
    this.tag(field, 1);
    const b = Buffer.alloc(8);
    b.writeBigUInt64LE(v);
    this.chunks.push(...b);
    return this;
  }
  double(field: number, v: number): this {
    this.tag(field, 1);
    const b = Buffer.alloc(8);
    b.writeDoubleLE(v);
    this.chunks.push(...b);
    return this;
  }
  bytes(field: number, v: Uint8Array): this {
    this.tag(field, 2);
    this.varintRaw(BigInt(v.length));
    this.chunks.push(...v);
    return this;
  }
  string(field: number, v: string): this {
    return this.bytes(field, Buffer.from(v, 'utf8'));
  }
  message(field: number, w: Writer): this {
    return this.bytes(field, w.finish());
  }
  finish(): Uint8Array {
    return Uint8Array.from(this.chunks);
  }
}
