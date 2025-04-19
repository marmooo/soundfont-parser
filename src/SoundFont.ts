import {
  createGeneratorObject,
  defaultInstrumentZone,
  GeneratorParams,
} from "./GeneratorParams.ts";
import { ParseResult } from "./Parser.ts";
import { Bag, BoundedValue, GeneratorList, RangeValue } from "./Structs.ts";

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
    presetZone: Partial<GeneratorParams>,
    instrumentZone: Partial<GeneratorParams>,
  ) {
    const instrument: GeneratorParams = {
      ...defaultInstrumentZone,
      ...instrumentZone,
    };
    const keys = Object.keys(presetZone) as (keyof GeneratorParams)[];
    for (const key of keys) {
      if (key !== "keyRange" && key !== "velRange") {
        const instrumentValue = instrument[key] as BoundedValue;
        const presetValue = presetZone[key] as BoundedValue;
        instrument[key] = new BoundedValue(
          instrumentValue.min,
          instrumentValue.value + presetValue.value,
          instrumentValue.max,
        );
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
    const modHold = timecentToSecond(
      gen.holdModEnv.clamp() + (key - 60) * gen.keynumToModEnvHold.clamp(),
    );
    const modDecay = timecentToSecond(
      gen.decayModEnv.clamp() + (key - 60) * gen.keynumToModEnvDecay.clamp(),
    );
    const sample = this.parsed.samples[gen.sampleID.value];
    const sampleHeader = this.parsed.sampleHeaders[gen.sampleID.value];
    const tune = gen.coarseTune.clamp() + gen.fineTune.clamp() / 100;
    const rootKey = gen.overridingRootKey.value === -1
      ? sampleHeader.originalPitch
      : gen.overridingRootKey.clamp();
    const basePitch = tune + sampleHeader.pitchCorrection / 100 - rootKey;
    const scaleTuning = gen.scaleTuning.clamp() / 100;
    return {
      // startAddrsOffset: gen.startAddrsOffset.clamp(),
      // endAddrsOffset: gen.endAddrsOffset.clamp(),
      start: gen.startAddrsCoarseOffset.clamp() * 32768 +
        gen.startAddrsOffset.clamp(),
      end: gen.endAddrsCoarseOffset.clamp() * 32768 +
        gen.endAddrsOffset.clamp(),
      // startloopAddrsOffset: gen.startloopAddrsOffset.clamp(),
      // endloopAddrsOffset: gen.endloopAddrsOffset.clamp(),
      loopStart: sampleHeader.loopStart +
        gen.startloopAddrsCoarseOffset.clamp() * 32768 +
        gen.startloopAddrsOffset.clamp(),
      loopEnd: sampleHeader.loopEnd +
        gen.endloopAddrsCoarseOffset.clamp() * 32768 +
        gen.endloopAddrsOffset.clamp(),
      modLfoToPitch: gen.modLfoToPitch.clamp(),
      vibLfoToPitch: gen.vibLfoToPitch.clamp(),
      modEnvToPitch: gen.modEnvToPitch.clamp(),
      initialFilterFc: gen.initialFilterFc.clamp(),
      initialFilterQ: gen.initialFilterQ.clamp(),
      modLfoToFilterFc: gen.modLfoToFilterFc.clamp(),
      modEnvToFilterFc: gen.modEnvToFilterFc.clamp(),
      // endAddrsCoarseOffset: gen.endAddrsCoarseOffset.clamp(),
      modLfoToVolume: gen.modLfoToVolume.clamp(),
      chorusEffectsSend: gen.chorusEffectsSend.clamp() / 1000,
      reverbEffectsSend: gen.reverbEffectsSend.clamp() / 1000,
      pan: gen.pan.clamp(),
      delayModLFO: timecentToSecond(gen.delayModLFO.clamp()),
      freqModLFO: gen.freqModLFO.clamp(),
      delayVibLFO: timecentToSecond(gen.delayVibLFO.clamp()),
      freqVibLFO: gen.freqVibLFO.clamp(),
      // delayModEnv: gen.delayModEnv.clamp(),
      // attackModEnv: gen.attackModEnv.clamp(),
      // holdModEnv: gen.holdModEnv.clamp(),
      // decayModEnv: gen.decayModEnv.clamp(),
      // sustainModEnv: gen.sustainModEnv.clamp(),
      // releaseModEnv: gen.releaseModEnv.clamp(),
      modDelay: timecentToSecond(gen.delayModEnv.clamp()),
      modAttack: timecentToSecond(gen.attackModEnv.clamp()),
      modHold,
      modDecay,
      modSustain: gen.sustainModEnv.clamp() / 1000,
      modRelease: timecentToSecond(gen.releaseModEnv.clamp()),
      // keynumToModEnvHold: gen.keynumToModEnvHold.clamp(),
      // keynumToModEnvDecay: gen.keynumToModEnvDecay.clamp(),
      // delayVolEnv: gen.delayVolEnv.clamp(),
      // attackVolEnv: gen.attackVolEnv.clamp(),
      // holdVolEnv: gen.holdVolEnv.clamp(),
      // decayVolEnv: gen.decayVolEnv.clamp(),
      // sustainVolEnv: gen.sustainVolEnv.clamp(),
      // releaseVolEnv: gen.releaseVolEnv.clamp(),
      volDelay: timecentToSecond(gen.delayVolEnv.clamp()),
      volAttack: timecentToSecond(gen.attackVolEnv.clamp()),
      volHold: timecentToSecond(gen.holdVolEnv.clamp()),
      volDecay: timecentToSecond(gen.decayVolEnv.clamp()),
      volSustain: gen.sustainVolEnv.clamp() / 1000,
      volRelease: timecentToSecond(gen.releaseVolEnv.clamp()),
      keynumToVolEnvHold: gen.keynumToVolEnvHold.clamp(),
      keynumToVolEnvDecay: gen.keynumToVolEnvDecay.clamp(),
      // instrument: gen.instrument.clamp(),
      keyRange: gen.keyRange,
      velRange: gen.velRange,
      // startloopAddrsCoarseOffset: gen.startloopAddrsCoarseOffset,
      keynum: gen.keynum.clamp(),
      velocity: gen.velocity.clamp(),
      initialAttenuation: gen.initialAttenuation.clamp(),
      // endloopAddrsCoarseOffset: gen.endloopAddrsCoarseOffset.clamp(),
      // coarseTune: gen.coarseTune.clamp(),
      // fineTune: gen.fineTune.clamp(),
      playbackRate: (key: number) =>
        Math.pow(Math.pow(2, 1 / 12), (key + basePitch) * scaleTuning),
      // sampleID: gen.sampleID.clamp(),
      sample,
      sampleRate: sampleHeader.sampleRate,
      sampleName: sampleHeader.sampleName,
      sampleModes: gen.sampleModes.clamp(),
      // scaleTuning,
      exclusiveClass: gen.exclusiveClass.clamp(),
      // overridingRootKey: gen.overridingRootKey.clamp(),
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
