export default class Stream {
  constructor(
    private data: Uint8Array,
    public offset: number,
  ) {}

  readString(size: number): string {
    const start = this.offset;
    const end = start + size;
    const data = this.data;
    let nul = data.subarray(start, end).indexOf(0);
    if (nul < 0) nul = size;
    const arr = new Array(nul);
    for (let i = 0; i < nul; i++) {
      arr[i] = data[start + i];
    }
    this.offset = end;
    return String.fromCharCode(...arr);
  }

  readWORD(): number {
    return this.data[this.offset++] | (this.data[this.offset++] << 8);
  }

  readDWORD(bigEndian: boolean = false): number {
    if (bigEndian) {
      return (
        ((this.data[this.offset++] << 24) |
          (this.data[this.offset++] << 16) |
          (this.data[this.offset++] << 8) |
          this.data[this.offset++]) >>>
        0
      );
    } else {
      return (
        (this.data[this.offset++] |
          (this.data[this.offset++] << 8) |
          (this.data[this.offset++] << 16) |
          (this.data[this.offset++] << 24)) >>>
        0
      );
    }
  }

  readByte() {
    return this.data[this.offset++];
  }

  readAt(offset: number) {
    return this.data[this.offset + offset];
  }

  /* helper */

  readUInt8() {
    return this.readByte();
  }

  readInt8() {
    return (this.readByte() << 24) >> 24;
  }

  readUInt16() {
    return this.readWORD();
  }

  readInt16() {
    return (this.readWORD() << 16) >> 16;
  }

  readUInt32() {
    return this.readDWORD();
  }
}
