import Stream from "./Stream.ts";

export function parseChunk(
  input: Uint8Array,
  offset: number,
  bigEndian: boolean,
): Chunk {
  const stream = new Stream(input, offset);
  const type = stream.readString(4);
  const size = stream.readDWORD(bigEndian);
  return new Chunk(type, size, stream.offset);
}

export interface Options {
  padding?: boolean;
  bigEndian?: boolean;
}

export function parseRiff(
  input: Uint8Array,
  index: number = 0,
  length: number,
  { padding = true, bigEndian = false }: Options = {},
) {
  const chunkList: Chunk[] = [];
  const end = length + index;
  let offset = index;

  while (offset < end) {
    const chunk = parseChunk(input, offset, bigEndian);
    offset = chunk.offset + chunk.size;

    // padding
    if (padding && ((offset - index) & 1) === 1) {
      offset++;
    }

    chunkList.push(chunk);
  }

  return chunkList;
}

export class Chunk {
  constructor(
    public type: string,
    public size: number,
    public offset: number,
  ) {}
}
