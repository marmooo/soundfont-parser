import {
  createInstrumentGeneratorObject,
  createPresetGeneratorObject,
  defaultInstrumentZone,
  InstrumentGeneratorParams,
  InstrumentParams,
  isRangeGenerator,
  PresetGeneratorParams,
} from "./Generator.ts";
import { ParseResult } from "./Parser.ts";
import { Bag, BoundedValue, GeneratorList } from "./Structs.ts";

export class SoundFont {
  parsed: ParseResult;

  constructor(parsed: ParseResult) {
    this.parsed = parsed;
  }

  getGenerators(
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
    return this.getGenerators(
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
    return this.getGenerators(
      this.parsed.instrumentGenerators,
      this.parsed.instrumentZone,
      instrument.instrumentBagIndex,
      nextInstrumentBagIndex,
    );
  }

  findInstrumentZone(instrumentID: number, key: number, velocity: number) {
    const instrumentGenerators = this.getInstrumentGenerators(instrumentID);
    let globalZone: Partial<InstrumentGeneratorParams> | undefined;
    for (let j = 0; j < instrumentGenerators.length; j++) {
      const zone = createInstrumentGeneratorObject(instrumentGenerators[j]);
      if (zone.sampleID === undefined) {
        globalZone = zone;
        continue;
      }
      if (zone.keyRange && !zone.keyRange.in(key)) continue;
      if (zone.velRange && !zone.velRange.in(velocity)) continue;
      if (globalZone) {
        return { ...globalZone, ...zone };
      } else {
        return zone;
      }
    }
    return;
  }

  findInstrument(presetHeaderIndex: number, key: number, velocity: number) {
    const presetGenerators = this.getPresetGenerators(presetHeaderIndex);
    let globalZone: Partial<PresetGeneratorParams> | undefined;
    for (let i = 0; i < presetGenerators.length; i++) {
      const zone = createPresetGeneratorObject(presetGenerators[i]);
      if (zone.instrument === undefined) {
        globalZone = zone;
        continue;
      }
      if (zone.keyRange && !zone.keyRange.in(key)) continue;
      if (zone.velRange && !zone.velRange.in(velocity)) continue;
      const instrumentZone = this.findInstrumentZone(
        zone.instrument.value,
        key,
        velocity,
      );
      if (instrumentZone) {
        if (globalZone) {
          return this.getInstrument({ ...globalZone, ...zone }, instrumentZone);
        } else {
          return this.getInstrument(zone, instrumentZone);
        }
      }
    }
    return null;
  }

  getInstrument(
    presetZone: Partial<PresetGeneratorParams>,
    instrumentZone: Partial<InstrumentGeneratorParams>,
  ) {
    const instrument: InstrumentGeneratorParams = {
      ...defaultInstrumentZone,
      ...instrumentZone,
    };
    const keys = Object.keys(presetZone) as (keyof PresetGeneratorParams)[];
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (isRangeGenerator(key)) continue;
      const instrumentValue = instrument[key] as BoundedValue;
      const presetValue = presetZone[key];
      instrument[key] = new BoundedValue(
        instrumentValue.min,
        instrumentValue.value + (presetValue as BoundedValue).value,
        instrumentValue.max,
      );
    }
    return instrument;
  }

  getInstrumentKey(
    bankNumber: number,
    instrumentNumber: number,
    key: number,
    velocity: number,
  ): NoteInfo | null {
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
    const gen = this.findInstrument(presetHeaderIndex, key, velocity);
    if (!gen) {
      console.warn(
        "instrument not found: bank=%s instrument=%s",
        bankNumber,
        instrumentNumber,
      );
      return null;
    }
    const clamped: InstrumentParams = {} as InstrumentParams;
    const keys = Object.keys(gen) as (keyof InstrumentGeneratorParams)[];
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (isRangeGenerator(key)) {
        clamped[key] = gen[key];
      } else {
        clamped[key] = gen[key].clamp();
      }
    }
    const modHold = timecentToSecond(
      clamped.holdModEnv + (key - 60) * clamped.keynumToModEnvHold,
    );
    const modDecay = timecentToSecond(
      clamped.decayModEnv + (key - 60) * clamped.keynumToModEnvDecay,
    );
    const volHold = timecentToSecond(
      clamped.holdVolEnv + (key - 60) * clamped.keynumToVolEnvHold,
    );
    const volDecay = timecentToSecond(
      clamped.decayVolEnv + (key - 60) * clamped.keynumToVolEnvDecay,
    );
    const sample = this.parsed.samples[clamped.sampleID];
    const sampleHeader = this.parsed.sampleHeaders[clamped.sampleID];
    const tune = clamped.coarseTune + clamped.fineTune / 100;
    const rootKey = clamped.overridingRootKey === -1
      ? sampleHeader.originalPitch
      : clamped.overridingRootKey;
    const basePitch = tune + sampleHeader.pitchCorrection / 100 - rootKey;
    const scaleTuning = clamped.scaleTuning / 100;
    return {
      // startAddrsOffset: clamped.startAddrsOffset,
      // endAddrsOffset: clamped.endAddrsOffset,
      start: clamped.startAddrsCoarseOffset * 32768 +
        clamped.startAddrsOffset,
      end: clamped.endAddrsCoarseOffset * 32768 +
        clamped.endAddrsOffset,
      // startloopAddrsOffset: clamped.startloopAddrsOffset,
      // endloopAddrsOffset: clamped.endloopAddrsOffset,
      loopStart: sampleHeader.loopStart +
        clamped.startloopAddrsCoarseOffset * 32768 +
        clamped.startloopAddrsOffset,
      loopEnd: sampleHeader.loopEnd +
        clamped.endloopAddrsCoarseOffset * 32768 +
        clamped.endloopAddrsOffset,
      modLfoToPitch: clamped.modLfoToPitch,
      vibLfoToPitch: clamped.vibLfoToPitch,
      modEnvToPitch: clamped.modEnvToPitch,
      initialFilterFc: clamped.initialFilterFc,
      initialFilterQ: clamped.initialFilterQ,
      modLfoToFilterFc: clamped.modLfoToFilterFc,
      modEnvToFilterFc: clamped.modEnvToFilterFc,
      // endAddrsCoarseOffset: clamped.endAddrsCoarseOffset,
      modLfoToVolume: clamped.modLfoToVolume,
      chorusEffectsSend: clamped.chorusEffectsSend / 1000,
      reverbEffectsSend: clamped.reverbEffectsSend / 1000,
      pan: clamped.pan,
      delayModLFO: timecentToSecond(clamped.delayModLFO),
      freqModLFO: clamped.freqModLFO,
      delayVibLFO: timecentToSecond(clamped.delayVibLFO),
      freqVibLFO: clamped.freqVibLFO,
      // delayModEnv: clamped.delayModEnv,
      // attackModEnv: clamped.attackModEnv,
      // holdModEnv: clamped.holdModEnv,
      // decayModEnv: clamped.decayModEnv,
      // sustainModEnv: clamped.sustainModEnv,
      // releaseModEnv: clamped.releaseModEnv,
      modDelay: timecentToSecond(clamped.delayModEnv),
      modAttack: timecentToSecond(clamped.attackModEnv),
      modHold,
      modDecay,
      modSustain: clamped.sustainModEnv / 1000,
      modRelease: timecentToSecond(clamped.releaseModEnv),
      // keynumToModEnvHold: clamped.keynumToModEnvHold,
      // keynumToModEnvDecay: clamped.keynumToModEnvDecay,
      // delayVolEnv: clamped.delayVolEnv,
      // attackVolEnv: clamped.attackVolEnv,
      // holdVolEnv: clamped.holdVolEnv,
      // decayVolEnv: clamped.decayVolEnv,
      // sustainVolEnv: clamped.sustainVolEnv,
      // releaseVolEnv: clamped.releaseVolEnv,
      volDelay: timecentToSecond(clamped.delayVolEnv),
      volAttack: timecentToSecond(clamped.attackVolEnv),
      volHold,
      volDecay,
      volSustain: clamped.sustainVolEnv / 1000,
      volRelease: timecentToSecond(clamped.releaseVolEnv),
      // keynumToVolEnvHold: clamped.keynumToVolEnvHold,
      // keynumToVolEnvDecay: clamped.keynumToVolEnvDecay,
      // instrument: clamped.instrument,
      // keyRange: clamped.keyRange,
      // velRange: clamped.velRange,
      // startloopAddrsCoarseOffset: clamped.startloopAddrsCoarseOffset,
      // keynum: clamped.keynum,
      // velocity: clamped.velocity,
      initialAttenuation: clamped.initialAttenuation,
      // endloopAddrsCoarseOffset: clamped.endloopAddrsCoarseOffset,
      // coarseTune: clamped.coarseTune,
      // fineTune: clamped.fineTune,
      playbackRate: (key: number) =>
        Math.pow(Math.pow(2, 1 / 12), (key + basePitch) * scaleTuning),
      // sampleID: clamped.sampleID,
      sample,
      sampleRate: sampleHeader.sampleRate,
      sampleName: sampleHeader.sampleName,
      sampleModes: clamped.sampleModes,
      // scaleTuning,
      exclusiveClass: clamped.exclusiveClass,
      // overridingRootKey: clamped.overridingRootKey,
    };
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

export function timecentToSecond(value: number) {
  return Math.pow(2, value / 1200);
}

export interface NoteInfo {
  // startAddrsOffset: number;
  // endAddrsOffset: number;
  start: number;
  end: number;
  // startloopAddrsOffset: number;
  // endloopAddrsOffset: number;
  loopStart: number;
  loopEnd: number;
  modLfoToPitch: number;
  vibLfoToPitch: number;
  modEnvToPitch: number;
  initialFilterFc: number;
  initialFilterQ: number;
  modLfoToFilterFc: number;
  modEnvToFilterFc: number;
  // endAddrsCoarseOffset: number;
  modLfoToVolume: number;
  chorusEffectsSend: number;
  reverbEffectsSend: number;
  pan: number;
  delayModLFO: number;
  freqModLFO: number;
  delayVibLFO: number;
  freqVibLFO: number;
  // delayModEnv: number;
  // attackModEnv: number;
  // holdModEnv: number;
  // decayModEnv: number;
  // sustainModEnv: number;
  // releaseModEnv: number;
  modDelay: number;
  modAttack: number;
  modHold: number;
  modDecay: number;
  modSustain: number;
  modRelease: number;
  // keynumToModEnvHold: number;
  // keynumToModEnvDecay: number;
  // delayVolEnv: number;
  // attackVolEnv: number;
  // holdVolEnv: number;
  // decayVolEnv: number;
  // sustainVolEnv: number;
  // releaseVolEnv: number;
  volDelay: number;
  volAttack: number;
  volHold: number;
  volDecay: number;
  volSustain: number;
  volRelease: number;
  // keynumToVolEnvHold: number;
  // keynumToVolEnvDecay: number;
  // instrument: number;
  // keyRange: RangeValue;
  // velRange: RangeValue;
  // startloopAddrsCoarseOffset: number;
  // keynum: number;
  // velocity: number;
  initialAttenuation: number;
  // endloopAddrsCoarseOffset: number;
  // coarseTune: number;
  // fineTune: number;
  playbackRate: (key: number) => number;
  // sampleID: number;
  sample: Uint8Array;
  sampleRate: number;
  sampleName: string;
  sampleModes: number;
  // scaleTuning: number;
  exclusiveClass: number;
  // overridingRootKey: number;
}
