import { GeneratorKeys } from "./Constants.ts";
import { BoundedValue, GeneratorList, RangeValue } from "./Structs.ts";

type GeneratorKey = typeof GeneratorKeys[number];
type GeneratorIndex = number;
const generatorKeyToIndex = new Map<GeneratorKey, GeneratorIndex>();
for (let i = 0; i < GeneratorKeys.length; i++) {
  generatorKeyToIndex.set(GeneratorKeys[i], i);
}

const IndexGeneratorKeys = [
  "instrument",
  "sampleID",
] as const;
export const RangeGeneratorKeys = [
  "keyRange",
  "velRange",
] as const;
export type RangeGeneratorKey = typeof RangeGeneratorKeys[number];
const SubstitutionGeneratorKeys = [
  "keynum",
  "velocity",
] as const;
const SampleGeneratorKeys = [
  "startAddrsOffset",
  "endAddrsOffset",
  "startloopAddrsOffset",
  "endloopAddrsOffset",
  "startAddrsCoarseOffset",
  "endAddrsCoarseOffset",
  "startloopAddrsCoarseOffset",
  "endloopAddrsCoarseOffset",
  "sampleModes",
  "exclusiveClass",
  "overridingRootKey",
] as const;
const presetExcludedKeys = [
  ...SampleGeneratorKeys,
  ...SubstitutionGeneratorKeys,
] as const;

const presetExcludedIndices = new Set<number>();
for (let i = 0; i < presetExcludedKeys.length; i++) {
  const key = presetExcludedKeys[i] as GeneratorKey;
  const index = generatorKeyToIndex.get(key);
  if (index !== undefined) presetExcludedIndices.add(index);
}

export type InstrumentAllowedKey = Exclude<GeneratorKey, undefined>;
type PresetExcludedKey = typeof presetExcludedKeys[number];
type PresetAllowedKey = Exclude<InstrumentAllowedKey, PresetExcludedKey>;
type NonValueGeneratorKey =
  | typeof SampleGeneratorKeys[number]
  | typeof SubstitutionGeneratorKeys[number]
  | typeof IndexGeneratorKeys[number]
  | typeof RangeGeneratorKeys[number];
export type ValueGeneratorKey = Exclude<
  InstrumentAllowedKey,
  NonValueGeneratorKey
>;
export type NonRangeGeneratorKey = Exclude<
  InstrumentAllowedKey,
  RangeGeneratorKey
>;

export type InstrumentGeneratorParams = {
  [key in InstrumentAllowedKey]: key extends RangeGeneratorKey ? RangeValue
    : number;
};
export type PresetGeneratorParams = {
  [key in PresetAllowedKey]: key extends RangeGeneratorKey ? RangeValue
    : number;
};
export type GeneratorParams = {
  [key in InstrumentAllowedKey]: key extends RangeGeneratorKey ? RangeValue
    : BoundedValue;
};

export function convertToInstrumentGeneratorParams(
  input: GeneratorParams,
): InstrumentGeneratorParams {
  const output = {} as InstrumentGeneratorParams;
  const keys = Object.keys(input) as InstrumentAllowedKey[];
  for (const key of keys) {
    const value = input[key];
    if (isRangeGenerator(key)) {
      output[key] = value as RangeValue;
    } else {
      const boundedValue = value as BoundedValue;
      output[key] = boundedValue.clamp(boundedValue.defaultValue);
    }
  }
  return output;
}

const fixedGenerators = [
  ["keynum", "keyRange"],
  ["velocity", "velRange"],
] as const;

const RangeGeneratorKeysSet = new Set(
  RangeGeneratorKeys as readonly string[],
);
export function isRangeGenerator(key: string): key is RangeGeneratorKey {
  return RangeGeneratorKeysSet.has(key as RangeGeneratorKey);
}

const nonValueGeneratorKeysSet = new Set<string>([
  ...IndexGeneratorKeys,
  ...RangeGeneratorKeys,
  ...SubstitutionGeneratorKeys,
  ...SampleGeneratorKeys,
]);

function extractValueGeneratorKeys(): ValueGeneratorKey[] {
  const result: ValueGeneratorKey[] = [];
  const length = GeneratorKeys.length;
  for (let i = 0; i < length; i++) {
    const key = GeneratorKeys[i];
    if (key !== undefined && !nonValueGeneratorKeysSet.has(key)) {
      result.push(key as ValueGeneratorKey);
    }
  }
  return result;
}

export const ValueGeneratorKeys: readonly ValueGeneratorKey[] =
  extractValueGeneratorKeys();
const ValueGeneratorKeysSet = new Set(
  ValueGeneratorKeys as readonly string[],
);
export function isValueGenerator(key: string): key is ValueGeneratorKey {
  return ValueGeneratorKeysSet.has(key as ValueGeneratorKey);
}

export function createPresetGeneratorObject(generators: GeneratorList[]) {
  const result: Partial<PresetGeneratorParams> = {};
  for (let i = 0; i < generators.length; i++) {
    const gen = generators[i];
    const type = gen.type;
    if (type === undefined) continue;
    if (presetExcludedIndices.has(gen.code)) continue;
    if (isRangeGenerator(type)) {
      result[type] = gen.value as RangeValue;
    } else {
      const key = type as Exclude<PresetAllowedKey, RangeGeneratorKey>;
      result[key] = gen.value as number;
    }
  }
  return result;
}

export function createInstrumentGeneratorObject(generators: GeneratorList[]) {
  const result: Partial<InstrumentGeneratorParams> = {};
  for (let i = 0; i < generators.length; i++) {
    const gen = generators[i];
    const type = gen.type;
    if (type === undefined) continue;
    if (isRangeGenerator(type)) {
      result[type] = gen.value as RangeValue;
    } else {
      const key = type as Exclude<InstrumentAllowedKey, RangeGeneratorKey>;
      result[key] = gen.value as number;
    }
  }
  for (let i = 0; i < fixedGenerators.length; i++) {
    const [src, dst] = fixedGenerators[i];
    const v = result[src];
    if (v === undefined) continue;
    result[dst] = new RangeValue(v, v);
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
