import {
  createGeneratorObject,
  defaultInstrumentZone,
  GeneratorParams,
} from "./GeneratorParams.ts";
import { ParseResult } from "./Parser.ts";
import { Bag, GeneratorList, RangeValue } from "./Structs.ts";

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

  findInstrumentZone(instrumentID: number, key: number, velocity = 100) {
    const instrumentGenerators = this.getInstrumentGenerators(instrumentID);
    let globalZone: Partial<GeneratorParams> | undefined;
    for (let j = 0; j < instrumentGenerators.length; j++) {
      const zone = createGeneratorObject(instrumentGenerators[j]);
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

  findInstrument(presetHeaderIndex: number, key: number, velocity = 100) {
    const presetGenerators = this.getPresetGenerators(presetHeaderIndex);
    let globalZone: Partial<GeneratorParams> | undefined;
    for (let i = 0; i < presetGenerators.length; i++) {
      const zone = createGeneratorObject(presetGenerators[i]);
      if (zone.instrument === undefined) {
        globalZone = zone;
        continue;
      }
      if (zone.keyRange && !zone.keyRange.in(key)) continue;
      if (zone.velRange && !zone.velRange.in(velocity)) continue;
      const instrumentZone = this.findInstrumentZone(
        zone.instrument,
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
    presetZone: Partial<GeneratorParams>,
    instrumentZone: Partial<GeneratorParams>,
  ) {
    const instrument = {
      ...defaultInstrumentZone,
      ...instrumentZone,
    };
    const keys = Object.keys(presetZone) as (keyof GeneratorParams)[];
    for (const key of keys) {
      if (key !== "keyRange" && key !== "velRange") {
        instrument[key] += presetZone[key] as number;
      }
    }
    return instrument;
  }

  getInstrumentKey(
    bankNumber: number,
    instrumentNumber: number,
    key: number,
    velocity = 100,
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
    const sample = this.parsed.samples[gen.sampleID];
    const sampleHeader = this.parsed.sampleHeaders[gen.sampleID];
    const tune = gen.coarseTune + gen.fineTune / 100;
    const rootKey = gen.overridingRootKey === -1
      ? sampleHeader.originalPitch
      : gen.overridingRootKey;
    const basePitch = tune + sampleHeader.pitchCorrection / 100 - rootKey;
    const scaleTuning = gen.scaleTuning / 100;
    return {
      // startAddrsOffset: gen.startAddrsOffset,
      // endAddrsOffset: gen.endAddrsOffset,
      start: gen.startAddrsCoarseOffset * 32768 + gen.startAddrsOffset,
      end: gen.endAddrsCoarseOffset * 32768 + gen.endAddrsOffset,
      // startloopAddrsOffset: gen.startloopAddrsOffset,
      // endloopAddrsOffset: gen.endloopAddrsOffset,
      loopStart: sampleHeader.loopStart +
        gen.startloopAddrsCoarseOffset * 32768 +
        gen.startloopAddrsOffset,
      loopEnd: sampleHeader.loopEnd +
        gen.endloopAddrsCoarseOffset * 32768 +
        gen.endloopAddrsOffset,
      modLfoToPitch: gen.modLfoToPitch,
      vibLfoToPitch: gen.vibLfoToPitch,
      modEnvToPitch: gen.modEnvToPitch,
      initialFilterFc: gen.initialFilterFc,
      initialFilterQ: gen.initialFilterQ,
      modLfoToFilterFc: gen.modLfoToFilterFc,
      modEnvToFilterFc: gen.modEnvToFilterFc,
      // endAddrsCoarseOffset: gen.endAddrsCoarseOffset,
      modLfoToVolume: gen.modLfoToVolume,
      chorusEffectsSend: gen.chorusEffectsSend,
      reverbEffectsSend: gen.reverbEffectsSend,
      pan: gen.pan,
      delayModLFO: timecentToSecond(gen.delayModLFO),
      freqModLFO: gen.freqModLFO,
      delayVibLFO: timecentToSecond(gen.delayVibLFO),
      freqVibLFO: gen.freqVibLFO,
      // delayModEnv: gen.delayModEnv,
      // attackModEnv: gen.attackModEnv,
      // holdModEnv: gen.holdModEnv,
      // decayModEnv: gen.decayModEnv,
      // sustainModEnv: gen.sustainModEnv,
      // releaseModEnv: gen.releaseModEnv,
      modDelay: timecentToSecond(gen.delayModEnv),
      modAttack: timecentToSecond(gen.attackModEnv),
      modHold: timecentToSecond(gen.holdModEnv),
      modDecay: timecentToSecond(gen.decayModEnv),
      modSustain: gen.sustainModEnv / 1000,
      modRelease: timecentToSecond(gen.releaseModEnv),
      keynumToModEnvHold: gen.keynumToModEnvHold,
      keynumToModEnvDecay: gen.keynumToModEnvDecay,
      // delayVolEnv: gen.delayVolEnv,
      // attackVolEnv: gen.attackVolEnv,
      // holdVolEnv: gen.holdVolEnv,
      // decayVolEnv: gen.decayVolEnv,
      // sustainVolEnv: gen.sustainVolEnv,
      // releaseVolEnv: gen.releaseVolEnv,
      volDelay: timecentToSecond(gen.delayVolEnv),
      volAttack: timecentToSecond(gen.attackVolEnv),
      volHold: timecentToSecond(gen.holdVolEnv),
      volDecay: timecentToSecond(gen.decayVolEnv),
      volSustain: gen.sustainVolEnv / 1000,
      volRelease: timecentToSecond(gen.releaseVolEnv),
      keynumToVolEnvHold: gen.keynumToVolEnvHold,
      keynumToVolEnvDecay: gen.keynumToVolEnvDecay,
      // instrument: gen.instrument,
      keyRange: gen.keyRange,
      velRange: gen.velRange,
      // startloopAddrsCoarseOffset: gen.startloopAddrsCoarseOffset,
      keynum: gen.keynum,
      velocity: gen.velocity,
      initialAttenuation: gen.initialAttenuation,
      // endloopAddrsCoarseOffset: gen.endloopAddrsCoarseOffset,
      // coarseTune: gen.coarseTune,
      // fineTune: gen.fineTune,
      playbackRate: (key: number) =>
        Math.pow(Math.pow(2, 1 / 12), (key + basePitch) * scaleTuning),
      // sampleID: gen.sampleID,
      sample,
      sampleRate: sampleHeader.sampleRate,
      sampleName: sampleHeader.sampleName,
      sampleModes: gen.sampleModes,
      // scaleTuning,
      exclusiveClass: gen.exclusiveClass,
      // overridingRootKey: gen.overridingRootKey,
    };
  }

  // presetNames[bankNumber][presetNumber] = presetName
  getPresetNames() {
    const bank: { [index: number]: { [index: number]: string } } = {};
    this.parsed.presetHeaders.forEach((preset) => {
      if (!bank[preset.bank]) {
        bank[preset.bank] = {};
      }
      bank[preset.bank][preset.preset] = preset.presetName;
    });
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
  keynumToModEnvHold: number;
  keynumToModEnvDecay: number;
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
  keynumToVolEnvHold: number;
  keynumToVolEnvDecay: number;
  // instrument: number;
  keyRange: RangeValue;
  velRange: RangeValue;
  // startloopAddrsCoarseOffset: number;
  keynum: number;
  velocity: number;
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
