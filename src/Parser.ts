import {
  Chunk,
  Options as RiffParserOptions,
  parseChunk,
  parseRiff,
} from "./RiffParser.ts";
import {
  Bag,
  GeneratorList,
  Info,
  Instrument,
  ModulatorList,
  PresetHeader,
  SampleHeader,
} from "./Structs.ts";
import Stream from "./Stream.ts";

export interface ParseResult {
  presetHeaders: PresetHeader[];
  presetZone: Bag[];
  presetModulators: ModulatorList[];
  presetGenerators: GeneratorList[];
  instruments: Instrument[];
  instrumentZone: Bag[];
  instrumentModulators: ModulatorList[];
  instrumentGenerators: GeneratorList[];
  sampleHeaders: SampleHeader[];
  samples: Uint8Array[];
  samplingData: SamplingData;
  info: Info;
}

export interface SamplingData {
  offsetMSB: number;
  offsetLSB: number | undefined;
}

export function parse(
  input: Uint8Array,
  option: RiffParserOptions = {},
): ParseResult {
  // parse RIFF chunk
  const chunkList = parseRiff(input, 0, input.length, option);

  if (chunkList.length !== 1) {
    throw new Error("wrong chunk length");
  }

  const chunk = chunkList[0];
  if (chunk === null) {
    throw new Error("chunk not found");
  }

  function parseRiffChunk(
    chunk: Chunk,
    data: Uint8Array,
    option: RiffParserOptions = {},
  ) {
    const chunkList = getChunkList(chunk, data, "RIFF", "sfbk", option);

    if (chunkList.length !== 3) {
      throw new Error("invalid sfbk structure");
    }

    const info = parseInfoList(chunkList[0], data);
    const isSF3 = info.version.major === 3;
    if (isSF3 && chunkList[2].type !== "LIST") { // remove padding
      chunkList[2] = parseChunk(data, chunkList[2].offset - 9, false);
    }
    return {
      // INFO-list
      info,

      // sdta-list
      samplingData: parseSdtaList(chunkList[1], data),

      // pdta-list
      ...parsePdtaList(chunkList[2], data, isSF3),
    };
  }

  function parsePdtaList(chunk: Chunk, data: Uint8Array, isSF3: boolean) {
    const chunkList = getChunkList(chunk, data, "LIST", "pdta");

    // check number of chunks
    if (chunkList.length !== 9) {
      throw new Error("invalid pdta chunk");
    }

    return {
      presetHeaders: parsePhdr(chunkList[0], data),
      presetZone: parsePbag(chunkList[1], data),
      presetModulators: parsePmod(chunkList[2], data),
      presetGenerators: parsePgen(chunkList[3], data),
      instruments: parseInst(chunkList[4], data),
      instrumentZone: parseIbag(chunkList[5], data),
      instrumentModulators: parseImod(chunkList[6], data),
      instrumentGenerators: parseIgen(chunkList[7], data),
      sampleHeaders: parseShdr(chunkList[8], data, isSF3),
    };
  }

  const result = parseRiffChunk(chunk, input, option);
  const isSF3 = result.info.version.major === 3;

  return {
    ...result,
    samples: loadSample(
      result.sampleHeaders,
      result.samplingData.offsetMSB,
      result.samplingData.offsetLSB,
      input,
      isSF3,
    ),
  };
}

function getChunkList(
  chunk: Chunk,
  data: Uint8Array,
  expectedType: string,
  expectedSignature: string,
  option: RiffParserOptions = {},
) {
  // check parse target
  if (chunk.type !== expectedType) {
    throw new Error("invalid chunk type:" + chunk.type);
  }

  const stream = new Stream(data, chunk.offset);

  // check signature
  const signature = stream.readString(4);
  if (signature !== expectedSignature) {
    throw new Error("invalid signature:" + signature);
  }

  // read structure
  return parseRiff(data, stream.ip, chunk.size - 4, option);
}

function parseInfoList(chunk: Chunk, data: Uint8Array) {
  const chunkList = getChunkList(chunk, data, "LIST", "INFO");
  return Info.parse(data, chunkList);
}

function parseSdtaList(chunk: Chunk, data: Uint8Array): SamplingData {
  const chunkList = getChunkList(chunk, data, "LIST", "sdta");

  return {
    offsetMSB: chunkList[0].offset,
    offsetLSB: chunkList[1]?.offset,
  };
}

function parseChunkObjecs<T>(
  chunk: Chunk,
  data: Uint8Array,
  type: string,
  clazz: { parse: (stream: Stream, isSF3?: boolean) => T },
  terminate?: (obj: T) => boolean,
  isSF3?: boolean,
): T[] {
  const result: T[] = [];

  if (chunk.type !== type) {
    throw new Error("invalid chunk type:" + chunk.type);
  }

  const stream = new Stream(data, chunk.offset);
  const size = chunk.offset + chunk.size;

  while (stream.ip < size) {
    const obj = clazz.parse(stream, isSF3);
    if (terminate && terminate(obj)) {
      break;
    }
    result.push(obj);
  }

  return result;
}

const parsePhdr = (chunk: Chunk, data: Uint8Array) =>
  parseChunkObjecs(chunk, data, "phdr", PresetHeader, (p) => p.isEnd);
const parsePbag = (chunk: Chunk, data: Uint8Array) =>
  parseChunkObjecs(chunk, data, "pbag", Bag);
const parseInst = (chunk: Chunk, data: Uint8Array) =>
  parseChunkObjecs(chunk, data, "inst", Instrument, (i) => i.isEnd);
const parseIbag = (chunk: Chunk, data: Uint8Array) =>
  parseChunkObjecs(chunk, data, "ibag", Bag);
const parsePmod = (chunk: Chunk, data: Uint8Array) =>
  parseChunkObjecs(chunk, data, "pmod", ModulatorList, (m) => m.isEnd);
const parseImod = (chunk: Chunk, data: Uint8Array) =>
  parseChunkObjecs(chunk, data, "imod", ModulatorList, (m) => m.isEnd);
const parsePgen = (chunk: Chunk, data: Uint8Array) =>
  parseChunkObjecs(chunk, data, "pgen", GeneratorList, (g) => g.isEnd);
const parseIgen = (chunk: Chunk, data: Uint8Array) =>
  parseChunkObjecs(chunk, data, "igen", GeneratorList);
const parseShdr = (chunk: Chunk, data: Uint8Array, isSF3: boolean) =>
  parseChunkObjecs(chunk, data, "shdr", SampleHeader, (s) => s.isEnd, isSF3);

function loadSample(
  sampleHeader: SampleHeader[],
  samplingDataOffsetMSB: number,
  _samplingDataOffsetLSB: number | undefined,
  data: Uint8Array,
  isSF3: boolean,
): Uint8Array[] {
  return sampleHeader.map((header) => {
    let { start, end } = header;
    if (!isSF3) {
      start *= 2;
      end *= 2;
    }
    // TODO: support 24bit sample
    return new Uint8Array(data.subarray(
      samplingDataOffsetMSB + start,
      samplingDataOffsetMSB + end,
    ));
  });
}
