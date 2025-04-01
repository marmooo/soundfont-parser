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

    const presetGenerators = this.getPresetGenerators(presetHeaderIndex);
    let globalPresetZone: Partial<GeneratorParams> | undefined;
    let globalInstrumentZone: Partial<GeneratorParams> | undefined;
    let targetInstrumentZone: Partial<GeneratorParams> | undefined;
    for (let i = 0; i < presetGenerators.length; i++) {
      const presetZone = createGeneratorObject(presetGenerators[i]);
      if (presetZone.instrument === undefined) {
        globalPresetZone = presetZone;
        continue;
      }
      if (presetZone.keyRange && !presetZone.keyRange.in(key)) continue;
      if (presetZone.velRange && !presetZone.velRange.in(velocity)) continue;
      const instrumentGenerators = this.getInstrumentGenerators(
        presetZone.instrument,
      );
      for (let j = 0; j < instrumentGenerators.length; j++) {
        const instrumentZone = createGeneratorObject(instrumentGenerators[j]);
        if (instrumentZone.sampleID === undefined) {
          globalInstrumentZone = instrumentZone;
          continue;
        }
        if (instrumentZone.keyRange && !instrumentZone.keyRange.in(key)) {
          continue;
        }
        if (instrumentZone.velRange && !instrumentZone.velRange.in(velocity)) {
          continue;
        }
        targetInstrumentZone = instrumentZone;
        break;
      }
      if (targetInstrumentZone) break;
    }
    if (!targetInstrumentZone) {
      console.warn(
        "instrument not found: bank=%s instrument=%s",
        bankNumber,
        instrumentNumber,
      );
      return null;
    }
    if (targetInstrumentZone.sampleID === undefined) {
      throw new Error("Invalid SoundFont: sampleID not found");
    }

    const gen = {
      ...defaultInstrumentZone,
      ...globalPresetZone || {},
      ...globalInstrumentZone || {},
      ...targetInstrumentZone,
    };

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
      delayModLFO: convertTime(gen.delayModLFO),
      freqModLFO: gen.freqModLFO,
      delayVibLFO: convertTime(gen.delayVibLFO),
      freqVibLFO: gen.freqVibLFO,
      // delayModEnv: gen.delayModEnv,
      // attackModEnv: gen.attackModEnv,
      // holdModEnv: gen.holdModEnv,
      // decayModEnv: gen.decayModEnv,
      // sustainModEnv: gen.sustainModEnv,
      // releaseModEnv: gen.releaseModEnv,
      modDelay: convertTime(gen.delayModEnv),
      modAttack: convertTime(gen.attackModEnv),
      modHold: convertTime(gen.holdModEnv),
      modDecay: convertTime(gen.decayModEnv),
      modSustain: gen.sustainModEnv / 1000,
      modRelease: convertTime(gen.releaseModEnv),
      keynumToModEnvHold: gen.keynumToModEnvHold,
      keynumToModEnvDecay: gen.keynumToModEnvDecay,
      // delayVolEnv: gen.delayVolEnv,
      // attackVolEnv: gen.attackVolEnv,
      // holdVolEnv: gen.holdVolEnv,
      // decayVolEnv: gen.decayVolEnv,
      // sustainVolEnv: gen.sustainVolEnv,
      // releaseVolEnv: gen.releaseVolEnv,
      volDelay: convertTime(gen.delayVolEnv),
      volAttack: convertTime(gen.attackVolEnv),
      volHold: convertTime(gen.holdVolEnv),
      volDecay: convertTime(gen.decayVolEnv),
      volSustain: gen.sustainVolEnv / 1000,
      volRelease: convertTime(gen.releaseVolEnv),
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

// value = 1200log2(sec) で表される時間を秒単位に変換する
export function convertTime(value: number) {
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
  // instrument: number | undefined;
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
  // sampleID: number | undefined;
  sample: Uint8Array;
  sampleRate: number;
  sampleName: string;
  sampleModes: number;
  // scaleTuning: number;
  exclusiveClass: number;
  // overridingRootKey: number;
}
