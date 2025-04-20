import { GeneratorEnumeratorTable } from "./Constants.ts";
import { BoundedValue, GeneratorList, RangeValue } from "./Structs.ts";

type RawAllowedKeys = typeof GeneratorEnumeratorTable[number];
type AllowedKeys = Exclude<RawAllowedKeys, undefined>;
export type GeneratorParams = {
  [key in AllowedKeys]: key extends "keyRange" | "velRange" ? RangeValue
    : BoundedValue;
};
const fixedGenerators = [
  ["keynum", "keyRange"],
  ["velocity", "velRange"],
] as const;

export function createGeneratorObject(generators: GeneratorList[]) {
  const result: Partial<GeneratorParams> = {};
  for (const gen of generators) {
    const type = gen.type;
    if (type === undefined) continue;
    if (type === "keyRange" || type === "velRange") {
      result[type] = gen.value as RangeValue;
    } else {
      const defaultValue = defaultInstrumentZone[type];
      result[type] = new BoundedValue(
        defaultValue.min,
        gen.value as number,
        defaultValue.max,
      );
    }
  }
  for (const [src, dst] of fixedGenerators) {
    const v = result[src];
    if (v instanceof BoundedValue && 0 <= v.value) {
      result[dst] = new RangeValue(v.value, v.value);
    }
  }
  return result;
}

const int16min = -32768;
const int16max = 32767;
export const defaultInstrumentZone: GeneratorParams = {
  startAddrsOffset: new BoundedValue(0, 0, int16max),
  endAddrsOffset: new BoundedValue(int16min, 0, 0),
  startloopAddrsOffset: new BoundedValue(int16min, 0, int16max),
  endloopAddrsOffset: new BoundedValue(int16min, 0, int16max),
  startAddrsCoarseOffset: new BoundedValue(0, 0, int16max),
  modLfoToPitch: new BoundedValue(-12000, 0, 12000),
  vibLfoToPitch: new BoundedValue(-12000, 0, 12000),
  modEnvToPitch: new BoundedValue(-12000, 0, 12000),
  initialFilterFc: new BoundedValue(1500, 13500, 13500),
  initialFilterQ: new BoundedValue(0, 0, 960),
  modLfoToFilterFc: new BoundedValue(-12000, 0, 12000),
  modEnvToFilterFc: new BoundedValue(-12000, 0, 12000),
  endAddrsCoarseOffset: new BoundedValue(int16min, 0, 0),
  modLfoToVolume: new BoundedValue(-960, 0, 960),
  chorusEffectsSend: new BoundedValue(0, 0, 1000),
  reverbEffectsSend: new BoundedValue(0, 0, 1000),
  pan: new BoundedValue(-500, 0, 500),
  delayModLFO: new BoundedValue(-12000, -12000, 5000),
  freqModLFO: new BoundedValue(-16000, 0, 4500),
  delayVibLFO: new BoundedValue(-12000, -12000, 5000),
  freqVibLFO: new BoundedValue(-16000, 0, 4500),
  delayModEnv: new BoundedValue(-12000, -12000, 5000),
  attackModEnv: new BoundedValue(-12000, -12000, 8000),
  holdModEnv: new BoundedValue(-12000, -12000, 5000),
  decayModEnv: new BoundedValue(-12000, -12000, 8000),
  sustainModEnv: new BoundedValue(0, 0, 1000),
  releaseModEnv: new BoundedValue(-12000, -12000, 8000),
  keynumToModEnvHold: new BoundedValue(-1200, 0, 1200),
  keynumToModEnvDecay: new BoundedValue(-1200, 0, 1200),
  delayVolEnv: new BoundedValue(-12000, -12000, 5000),
  attackVolEnv: new BoundedValue(-12000, -12000, 8000),
  holdVolEnv: new BoundedValue(-12000, -12000, 5000),
  decayVolEnv: new BoundedValue(-12000, -12000, 8000),
  sustainVolEnv: new BoundedValue(0, 0, 1440),
  releaseVolEnv: new BoundedValue(-12000, -12000, 8000),
  keynumToVolEnvHold: new BoundedValue(-1200, 0, 1200),
  keynumToVolEnvDecay: new BoundedValue(-1200, 0, 1200),
  instrument: new BoundedValue(-1, -1, int16max),
  keyRange: new RangeValue(0, 127),
  velRange: new RangeValue(0, 127),
  startloopAddrsCoarseOffset: new BoundedValue(int16min, 0, int16max),
  keynum: new BoundedValue(-1, -1, 127),
  velocity: new BoundedValue(-1, -1, 127),
  initialAttenuation: new BoundedValue(0, 0, 1440),
  endloopAddrsCoarseOffset: new BoundedValue(int16min, 0, int16max),
  coarseTune: new BoundedValue(-120, 0, 120),
  fineTune: new BoundedValue(-99, 0, 99),
  sampleID: new BoundedValue(-1, -1, int16max),
  sampleModes: new BoundedValue(0, 0, 3),
  scaleTuning: new BoundedValue(0, 100, 100),
  exclusiveClass: new BoundedValue(0, 0, 127),
  overridingRootKey: new BoundedValue(-1, -1, 127),
};
