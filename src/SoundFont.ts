import {
  convertToInstrumentGeneratorParams,
  createInstrumentGeneratorObject,
  createPresetGeneratorObject,
  defaultInstrumentZone,
  InstrumentGeneratorParams,
  isRangeGenerator,
  PresetGeneratorParams,
} from "./Generator.ts";
import { Voice } from "./Voice.ts";
import { ParseResult } from "./Parser.ts";
import { Bag, GeneratorList, ModulatorList } from "./Structs.ts";
import { DefaultModulators } from "./DefaultModulators.ts";

class InstrumentZone {
  constructor(
    public generators: Partial<InstrumentGeneratorParams>,
    public modulators: ModulatorList[],
  ) {}
}

class PresetZone {
  constructor(
    public generators: Partial<PresetGeneratorParams>,
    public modulators: ModulatorList[],
  ) {}
}

export class SoundFont {
  constructor(public parsed: ParseResult) {}

  getGeneratorParams(
    generators: GeneratorList[],
    zone: Bag[],
    from: number,
    to: number,
  ) {
    const result = new Array(to - from);
    for (let i = from; i < to; i++) {
      const segmentFrom = zone[i].generatorIndex;
      const segmentTo = zone[i + 1].generatorIndex;
      result[i - from] = generators.slice(segmentFrom, segmentTo);
    }
    return result;
  }

  getPresetGenerators(presetHeaderIndex: number) {
    const presetHeader = this.parsed.presetHeaders[presetHeaderIndex];
    const nextPresetHeader = this.parsed.presetHeaders[presetHeaderIndex + 1];
    const nextPresetBagIndex = nextPresetHeader
      ? nextPresetHeader.presetBagIndex
      : this.parsed.presetZone.length - 1;
    return this.getGeneratorParams(
      this.parsed.presetGenerators,
      this.parsed.presetZone,
      presetHeader.presetBagIndex,
      nextPresetBagIndex,
    );
  }

  getInstrumentGenerators(instrumentID: number) {
    const instrument = this.parsed.instruments[instrumentID];
    const nextInstrument = this.parsed.instruments[instrumentID + 1];
    const nextInstrumentBagIndex = nextInstrument
      ? nextInstrument.instrumentBagIndex
      : this.parsed.instrumentZone.length - 1;
    return this.getGeneratorParams(
      this.parsed.instrumentGenerators,
      this.parsed.instrumentZone,
      instrument.instrumentBagIndex,
      nextInstrumentBagIndex,
    );
  }

  getModulators(
    modulators: ModulatorList[],
    zone: Bag[],
    from: number,
    to: number,
  ) {
    const result = new Array(to - from);
    for (let i = from; i < to; i++) {
      const segmentFrom = zone[i].modulatorIndex;
      const segmentTo = zone[i + 1].modulatorIndex;
      result[i - from] = modulators.slice(segmentFrom, segmentTo);
    }
    return result;
  }

  getPresetModulators(presetHeaderIndex: number) {
    const presetHeader = this.parsed.presetHeaders[presetHeaderIndex];
    const nextPresetHeader = this.parsed.presetHeaders[presetHeaderIndex + 1];
    const nextPresetBagIndex = nextPresetHeader
      ? nextPresetHeader.presetBagIndex
      : this.parsed.presetZone.length - 1;
    return this.getModulators(
      this.parsed.presetModulators,
      this.parsed.presetZone,
      presetHeader.presetBagIndex,
      nextPresetBagIndex,
    );
  }

  getInstrumentModulators(instrumentID: number) {
    const instrument = this.parsed.instruments[instrumentID];
    const nextInstrument = this.parsed.instruments[instrumentID + 1];
    const nextInstrumentBagIndex = nextInstrument
      ? nextInstrument.instrumentBagIndex
      : this.parsed.instrumentZone.length - 1;
    return this.getModulators(
      this.parsed.instrumentModulators,
      this.parsed.instrumentZone,
      instrument.instrumentBagIndex,
      nextInstrumentBagIndex,
    );
  }

  findInstrumentZone(instrumentID: number, key: number, velocity: number) {
    const instrumentGenerators = this.getInstrumentGenerators(instrumentID);
    const instrumentModulators = this.getInstrumentModulators(instrumentID);
    let globalGenerators: Partial<InstrumentGeneratorParams> | undefined;
    let globalModulators: ModulatorList[] = [];
    for (let i = 0; i < instrumentGenerators.length; i++) {
      const generators = createInstrumentGeneratorObject(
        instrumentGenerators[i],
      );
      if (generators.sampleID === undefined) {
        globalGenerators = generators;
        globalModulators = instrumentModulators[i];
        continue;
      }
      if (generators.keyRange && !generators.keyRange.in(key)) continue;
      if (generators.velRange && !generators.velRange.in(velocity)) continue;
      if (globalGenerators) {
        const gen = { ...globalGenerators, ...generators };
        const mod = [...globalModulators, ...instrumentModulators[i]];
        return new InstrumentZone(gen, mod);
      } else {
        return new InstrumentZone(generators, instrumentModulators[i]);
      }
    }
    return;
  }

  findInstrument(presetHeaderIndex: number, key: number, velocity: number) {
    const presetGenerators = this.getPresetGenerators(presetHeaderIndex);
    const presetModulators = this.getPresetModulators(presetHeaderIndex);
    let globalGenerators: Partial<PresetGeneratorParams> | undefined;
    let globalModulators: ModulatorList[] = [];
    for (let i = 0; i < presetGenerators.length; i++) {
      const generators = createPresetGeneratorObject(presetGenerators[i]);
      if (generators.instrument === undefined) {
        globalGenerators = generators;
        globalModulators = presetModulators[i];
        continue;
      }
      if (generators.keyRange && !generators.keyRange.in(key)) continue;
      if (generators.velRange && !generators.velRange.in(velocity)) continue;
      const instrumentZone = this.findInstrumentZone(
        generators.instrument,
        key,
        velocity,
      );
      if (instrumentZone) {
        if (globalGenerators) {
          const gen = { ...globalGenerators, ...generators };
          const mod = [...globalModulators, ...presetModulators[i]];
          const presetZone = new PresetZone(gen, mod);
          return this.createVoice(key, presetZone, instrumentZone);
        } else {
          const presetZone = new PresetZone(generators, presetModulators[i]);
          return this.createVoice(key, presetZone, instrumentZone);
        }
      }
    }
    return null;
  }

  createVoice(
    key: number,
    presetZone: PresetZone,
    instrumentZone: InstrumentZone,
  ) {
    const instrumentGenerators = convertToInstrumentGeneratorParams(
      defaultInstrumentZone,
    );
    Object.assign(instrumentGenerators, instrumentZone.generators);
    const keys = Object.keys(
      presetZone.generators,
    ) as (keyof PresetGeneratorParams)[];
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (isRangeGenerator(key)) continue;
      instrumentGenerators[key] = presetZone.generators[key]!;
    }
    const modulators = [
      ...DefaultModulators,
      ...presetZone.modulators,
      ...instrumentZone.modulators,
    ];
    const sampleID = defaultInstrumentZone.sampleID.clamp(
      instrumentGenerators.sampleID,
    );
    const sample = this.parsed.samples[sampleID];
    const sampleHeader = this.parsed.sampleHeaders[sampleID];
    return new Voice(
      key,
      instrumentGenerators,
      modulators,
      sample,
      sampleHeader,
    );
  }

  getVoice(
    bankNumber: number,
    instrumentNumber: number,
    key: number,
    velocity: number,
  ): Voice | null {
    const presetHeaderIndex = this.parsed.presetHeaders.findIndex(
      (p) => p.preset === instrumentNumber && p.bank === bankNumber,
    );
    if (presetHeaderIndex < 0) {
      console.warn(
        "preset not found: bank=%s instrument=%s",
        bankNumber,
        instrumentNumber,
      );
      return null;
    }
    const instrument = this.findInstrument(presetHeaderIndex, key, velocity);
    if (!instrument) {
      console.warn(
        "instrument not found: bank=%s instrument=%s",
        bankNumber,
        instrumentNumber,
      );
      return null;
    }
    return instrument;
  }

  // presetNames[bankNumber][presetNumber] = presetName
  getPresetNames() {
    const bank: { [index: number]: { [index: number]: string } } = {};
    const presetHeaders = this.parsed.presetHeaders;
    for (let i = 0; i < presetHeaders.length; i++) {
      const preset = presetHeaders[i];
      if (!bank[preset.bank]) {
        bank[preset.bank] = {};
      }
      bank[preset.bank][preset.preset] = preset.presetName;
    }
    return bank;
  }
}
