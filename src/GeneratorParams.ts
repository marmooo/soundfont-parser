import { GeneratorEnumeratorTable } from "./Constants.ts";
import { GeneratorList, RangeValue } from "./Structs.ts";

type RawAllowedKeys = typeof GeneratorEnumeratorTable[number];
type AllowedKeys = Exclude<RawAllowedKeys, undefined>;
export type GeneratorParams = {
  [key in AllowedKeys]: key extends "keyRange" | "velRange" ? RangeValue
    : number;
};

export function createGeneratorObject(generators: GeneratorList[]) {
  const result: Partial<GeneratorParams> = {};
  for (const gen of generators) {
    const type = gen.type;
    if (type !== undefined) {
      if (type === "keyRange" || type === "velRange") {
        result[type] = gen.value as RangeValue;
      } else {
        result[type] = gen.value as number;
      }
    }
  }
  return result;
}

export const defaultInstrumentZone: GeneratorParams = {
  startAddrsOffset: 0,
  endAddrsOffset: 0,
  startloopAddrsOffset: 0,
  endloopAddrsOffset: 0,
  startAddrsCoarseOffset: 0,
  modLfoToPitch: 0,
  vibLfoToPitch: 0,
  modEnvToPitch: 0,
  initialFilterFc: 13500,
  initialFilterQ: 0,
  modLfoToFilterFc: 0,
  modEnvToFilterFc: 0,
  endAddrsCoarseOffset: 0,
  modLfoToVolume: 0,
  chorusEffectsSend: 0,
  reverbEffectsSend: 0,
  pan: 0,
  delayModLFO: -12000,
  freqModLFO: 0,
  delayVibLFO: -12000,
  freqVibLFO: 0,
  delayModEnv: -12000,
  attackModEnv: -12000,
  holdModEnv: -12000,
  decayModEnv: -12000,
  sustainModEnv: 0,
  releaseModEnv: -12000,
  keynumToModEnvHold: 0,
  keynumToModEnvDecay: 0,
  delayVolEnv: -12000,
  attackVolEnv: -12000,
  holdVolEnv: -12000,
  decayVolEnv: -12000,
  sustainVolEnv: 0,
  releaseVolEnv: -12000,
  keynumToVolEnvHold: 0,
  keynumToVolEnvDecay: 0,
  instrument: -1,
  keyRange: new RangeValue(0, 127),
  velRange: new RangeValue(0, 127),
  startloopAddrsCoarseOffset: 0,
  keynum: -1,
  velocity: -1,
  initialAttenuation: 0,
  endloopAddrsCoarseOffset: 0,
  coarseTune: 0,
  fineTune: 0,
  sampleID: -1,
  sampleModes: 0,
  scaleTuning: 100,
  exclusiveClass: 0,
  overridingRootKey: -1,
};
