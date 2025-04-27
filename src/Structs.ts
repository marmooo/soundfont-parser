import { GeneratorNames } from "./Constants.ts";
import Stream from "./Stream.ts";
import { Chunk } from "./RiffParser.ts";

export class VersionTag {
  constructor(
    public major: number,
    public minor: number,
  ) {}

  static parse(stream: Stream) {
    const major = stream.readInt8();
    const minor = stream.readInt8();
    return new VersionTag(major, minor);
  }
}

export class Info {
  constructor(
    public comment: string | null,
    public copyright: string | null,
    public creationDate: string | null,
    public engineer: string | null,
    public name: string,
    public product: string | null,
    public software: string | null,
    public version: VersionTag,
    public soundEngine: string,
    public romName: string | null,
    public romVersion: VersionTag | null,
  ) {}

  static parse(data: Uint8Array, chunks: Chunk[]) {
    function getChunk(type: string) {
      for (let i = 0; i < chunks.length; i++) {
        if (chunks[i].type === type) return chunks[i];
      }
      return undefined;
    }

    function toStream(chunk: Chunk) {
      return new Stream(data, chunk.offset);
    }

    function readString(type: string) {
      const chunk = getChunk(type);
      if (!chunk) return null;
      return toStream(chunk).readString(chunk.size);
    }

    function readVersionTag(type: string) {
      const chunk = getChunk(type);
      if (!chunk) return null;
      return VersionTag.parse(toStream(chunk));
    }

    const comment = readString("ICMT");
    const copyright = readString("ICOP");
    const creationDate = readString("ICRD");
    const engineer = readString("IENG");
    const name = readString("INAM")!;
    const product = readString("IPRD");
    const software = readString("ISFT");
    const version = readVersionTag("ifil")!;
    const soundEngine = readString("isng")!;
    const romName = readString("irom");
    const romVersion = readVersionTag("iver");
    return new Info(
      comment,
      copyright,
      creationDate,
      engineer,
      name,
      product,
      software,
      version,
      soundEngine,
      romName,
      romVersion,
    );
  }
}

export class Bag {
  constructor(
    public generatorIndex: number,
    public modulatorIndex: number,
  ) {}

  static parse(stream: Stream) {
    const generatorIndex = stream.readWORD();
    const modulatorIndex = stream.readWORD();
    return new Bag(generatorIndex, modulatorIndex);
  }
}

export class PresetHeader {
  constructor(
    public presetName: string,
    public preset: number,
    public bank: number,
    public presetBagIndex: number,
    public library: number,
    public genre: number,
    public morphology: number,
  ) {}

  get isEnd() {
    return this.presetName === "EOP";
  }

  static parse(stream: Stream) {
    const presetName = stream.readString(20);
    const preset = stream.readWORD();
    const bank = stream.readWORD();
    const presetBagIndex = stream.readWORD();
    const library = stream.readDWORD();
    const genre = stream.readDWORD();
    const morphology = stream.readDWORD();
    return new PresetHeader(
      presetName,
      preset,
      bank,
      presetBagIndex,
      library,
      genre,
      morphology,
    );
  }
}

export class RangeValue {
  lo: number;
  hi: number;

  constructor(lo: number, hi: number) {
    this.lo = lo;
    this.hi = hi;
  }

  in(value: number) {
    return (this.lo <= value && value <= this.hi);
  }

  static parse(stream: Stream) {
    const lo = stream.readByte();
    const hi = stream.readByte();
    return new RangeValue(lo, hi);
  }
}

export class ModulatorList {
  constructor(
    public sourceOper: number,
    public destinationOper: number,
    public value: number,
    public amountSourceOper: number,
    public transOper: number,
  ) {}

  get type() {
    return GeneratorNames[this.destinationOper];
  }

  get isEnd() {
    return (
      this.sourceOper === 0 &&
      this.destinationOper === 0 &&
      this.value === 0 &&
      this.amountSourceOper === 0 &&
      this.transOper === 0
    );
  }

  static parse(stream: Stream) {
    const sourceOper = stream.readWORD();
    const destinationOper = stream.readWORD();
    const value = stream.readInt16();
    const amountSourceOper = stream.readWORD();
    const transOper = stream.readWORD();
    return new ModulatorList(
      sourceOper,
      destinationOper,
      value,
      amountSourceOper,
      transOper,
    );
  }
}

export class GeneratorList {
  constructor(
    public code: number,
    public value: number | RangeValue,
  ) {}

  get type() {
    return GeneratorNames[this.code];
  }

  get isEnd() {
    return this.code === 0 && this.value === 0;
  }

  static parse(stream: Stream) {
    const code = stream.readWORD();
    const type = GeneratorNames[code];

    let value: number | RangeValue;
    switch (type) {
      case "keyRange":
      case "velRange":
        value = RangeValue.parse(stream);
        break;
      default:
        value = stream.readInt16();
        break;
    }

    return new GeneratorList(code, value);
  }
}

export class Instrument {
  instrumentName!: string;
  instrumentBagIndex!: number;

  get isEnd() {
    return this.instrumentName === "EOI";
  }

  static parse(stream: Stream) {
    const t = new Instrument();
    t.instrumentName = stream.readString(20);
    t.instrumentBagIndex = stream.readWORD();
    return t;
  }
}

export class SampleHeader {
  constructor(
    public sampleName: string,
    public start: number,
    public end: number,
    public loopStart: number,
    public loopEnd: number,
    public sampleRate: number,
    public originalPitch: number,
    public pitchCorrection: number,
    public sampleLink: number,
    public sampleType: number,
  ) {}

  get isEnd() {
    return this.sampleName === "EOS";
  }

  static parse(stream: Stream, isSF3?: boolean) {
    const sampleName = stream.readString(20);
    const start = stream.readDWORD();
    const end = stream.readDWORD();
    let loopStart = stream.readDWORD();
    let loopEnd = stream.readDWORD();
    const sampleRate = stream.readDWORD();
    const originalPitch = stream.readByte();
    const pitchCorrection = stream.readInt8();
    const sampleLink = stream.readWORD();
    const sampleType = stream.readWORD();

    if (!isSF3) {
      loopStart -= start;
      loopEnd -= start;
    }

    return new SampleHeader(
      sampleName,
      start,
      end,
      loopStart,
      loopEnd,
      sampleRate,
      originalPitch,
      pitchCorrection,
      sampleLink,
      sampleType,
    );
  }
}

export const SampleLink = {
  monoSample: 1,
  rightSample: 2,
  leftSample: 4,
  linkedSample: 8,
  RomMonoSample: 0x8001,
  RomRightSample: 0x8002,
  RomLeftSample: 0x8004,
  RomLinkedSample: 0x8008,
};

export class BoundedValue {
  min: number;
  max: number;
  value: number;

  constructor(min: number, value: number, max: number) {
    this.min = min;
    this.value = value;
    this.max = max;
  }

  clamp(): number {
    return Math.max(this.min, Math.min(this.value, this.max));
  }
}
