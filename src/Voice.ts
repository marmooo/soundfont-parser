import {
  GeneratorParams,
  isValueGenerator,
  ValueGeneratorKey,
  ValueGeneratorKeys,
} from "./Generator.ts";
import { GeneratorKeys } from "./Constants.ts";
import { ModulatorList, SampleHeader } from "./Structs.ts";

export function timecentToSecond(value: number) {
  return Math.pow(2, value / 1200);
}

export class Voice {
  controllerIndex = new Map<number, ModulatorList[]>();
  generatorIndex = new Map<number, ModulatorList[]>();

  constructor(
    public key: number,
    public generators: GeneratorParams,
    public modulators: ModulatorList[],
    public sample: Uint8Array,
    public sampleHeader: SampleHeader,
  ) {
    this.setControllerIndex();
    this.setGeneratorIndex();
  }

  setControllerIndex() {
    for (let i = 0; i < this.modulators.length; i++) {
      const modulator = this.modulators[i];
      const controllerType = modulator.sourceOper.controllerType;
      const list = this.controllerIndex.get(controllerType);
      if (list) {
        list.push(modulator);
      } else {
        this.controllerIndex.set(controllerType, [modulator]);
      }
    }
  }

  setGeneratorIndex() {
    for (let i = 0; i < this.modulators.length; i++) {
      const modulator = this.modulators[i];
      const generatorKey = modulator.destinationOper;
      const list = this.generatorIndex.get(generatorKey);
      if (list) {
        list.push(modulator);
      } else {
        this.generatorIndex.set(generatorKey, [modulator]);
      }
    }
  }

  getModHold(holdModEnv: number, keynumToModEnvHold: number) {
    return timecentToSecond(holdModEnv + (this.key - 60) * keynumToModEnvHold);
  }

  getModDecay(decayModEnv: number, keynumToModEnvDecay: number) {
    return timecentToSecond(
      decayModEnv + (this.key - 60) * keynumToModEnvDecay,
    );
  }

  getVolHold(holdVolEnv: number, keynumToVolEnvHold: number) {
    return timecentToSecond(holdVolEnv + (this.key - 60) * keynumToVolEnvHold);
  }

  getVolDecay(decayVolEnv: number, keynumToVolEnvDecay: number) {
    return timecentToSecond(
      decayVolEnv + (this.key - 60) * keynumToVolEnvDecay,
    );
  }

  getPlaybackRate(generators: GeneratorParams) {
    const tune = generators.coarseTune + generators.fineTune / 100;
    const rootKey = generators.overridingRootKey === -1
      ? this.sampleHeader.originalPitch
      : generators.overridingRootKey;
    const basePitch = tune + this.sampleHeader.pitchCorrection / 100 - rootKey;
    const scaleTuning = generators.scaleTuning / 100;
    return Math.pow(Math.pow(2, 1 / 12), (this.key + basePitch) * scaleTuning);
  }

  getGeneratorParams(
    controllerType: number,
    controllerValue: number,
    controllerState: Float32Array,
  ) {
    const params: Partial<Record<ValueGeneratorKey, number>> = {};
    const modulators = this.controllerIndex.get(controllerType);
    if (!modulators) return params;
    for (const modulator of modulators) {
      const generatorKey = GeneratorKeys[modulator.destinationOper];
      if (!generatorKey) continue;
      if (!isValueGenerator(generatorKey)) continue;
      const source = modulator.sourceOper;
      const primary = source.map(controllerValue);
      let secondary = 1;
      const amountSource = modulator.amountSourceOper;
      if (!(amountSource.cc === 0 && amountSource.index === 0)) {
        const amount = controllerState[amountSource.controllerType];
        secondary = amountSource.map(amount);
      }
      const generatorValue = this.generators[generatorKey] +
        modulator.transform(primary * secondary);
      params[generatorKey] = generatorValue;
    }
    return params;
  }

  getTransformedGeneratorParams(controllerState: Float32Array) {
    const params = structuredClone(this.generators);
    for (const modulator of this.modulators) {
      const controllerType = modulator.sourceOper.controllerType;
      const controllerValue = controllerState[controllerType];
      if (!controllerValue) continue;
      const generatorKey = GeneratorKeys[modulator.destinationOper];
      if (!generatorKey) continue;
      if (!isValueGenerator(generatorKey)) continue;
      const source = modulator.sourceOper;
      const primary = source.map(controllerValue);
      let secondary = 1;
      const amountSource = modulator.amountSourceOper;
      if (!(amountSource.cc === 0 && amountSource.index === 0)) {
        const amount = controllerState[amountSource.controllerType];
        secondary = amountSource.map(amount);
      }
      const generatorValue = this.generators[generatorKey] +
        modulator.transform(primary * secondary);
      params[generatorKey] = generatorValue;
    }
    return params;
  }

  voiceHandlers: {
    [K in ValueGeneratorKey]: (
      params: Partial<VoiceParams>,
      generators: GeneratorParams,
    ) => void;
  } = {
    // startAddrsOffset
    // endAddrsOffset
    // startloopAddrsOffset
    // endloopAddrsOffset
    modLfoToPitch: (
      params: Partial<VoiceParams>,
      generators: GeneratorParams,
    ) => {
      params.modLfoToPitch = generators.modLfoToPitch;
    },
    vibLfoToPitch: (
      params: Partial<VoiceParams>,
      generators: GeneratorParams,
    ) => {
      params.vibLfoToPitch = generators.vibLfoToPitch;
    },
    modEnvToPitch: (
      params: Partial<VoiceParams>,
      generators: GeneratorParams,
    ) => {
      params.modEnvToPitch = generators.modEnvToPitch;
    },
    initialFilterFc: (
      params: Partial<VoiceParams>,
      generators: GeneratorParams,
    ) => {
      params.initialFilterFc = generators.initialFilterFc;
    },
    initialFilterQ: (
      params: Partial<VoiceParams>,
      generators: GeneratorParams,
    ) => {
      params.initialFilterQ = generators.initialFilterQ;
    },
    modLfoToFilterFc: (
      params: Partial<VoiceParams>,
      generators: GeneratorParams,
    ) => {
      params.modLfoToFilterFc = generators.modLfoToFilterFc;
    },
    modEnvToFilterFc: (
      params: Partial<VoiceParams>,
      generators: GeneratorParams,
    ) => {
      params.modEnvToFilterFc = generators.modEnvToFilterFc;
    },
    // endAddrsCoarseOffset
    modLfoToVolume: (
      params: Partial<VoiceParams>,
      generators: GeneratorParams,
    ) => {
      params.modLfoToVolume = generators.modLfoToVolume;
    },
    chorusEffectsSend: (
      params: Partial<VoiceParams>,
      generators: GeneratorParams,
    ) => {
      params.chorusEffectsSend = generators.chorusEffectsSend / 1000;
    },
    reverbEffectsSend: (
      params: Partial<VoiceParams>,
      generators: GeneratorParams,
    ) => {
      params.reverbEffectsSend = generators.reverbEffectsSend / 1000;
    },
    pan: (params: Partial<VoiceParams>, generators: GeneratorParams) => {
      params.pan = generators.pan / 1000;
    },
    delayModLFO: (
      params: Partial<VoiceParams>,
      generators: GeneratorParams,
    ) => {
      params.delayModLFO = timecentToSecond(generators.delayModLFO);
    },
    freqModLFO: (params: Partial<VoiceParams>, generators: GeneratorParams) => {
      params.freqModLFO = generators.freqModLFO;
    },
    delayVibLFO: (
      params: Partial<VoiceParams>,
      generators: GeneratorParams,
    ) => {
      params.delayVibLFO = timecentToSecond(generators.delayVibLFO);
    },
    freqVibLFO: (params: Partial<VoiceParams>, generators: GeneratorParams) => {
      params.freqVibLFO = generators.freqVibLFO;
    },
    delayModEnv: (
      params: Partial<VoiceParams>,
      generators: GeneratorParams,
    ) => {
      params.modDelay = timecentToSecond(generators.delayModEnv);
    },
    attackModEnv: (
      params: Partial<VoiceParams>,
      generators: GeneratorParams,
    ) => {
      params.modAttack = timecentToSecond(generators.attackModEnv);
    },
    holdModEnv: (params: Partial<VoiceParams>, generators: GeneratorParams) => {
      const { holdModEnv, keynumToModEnvHold } = generators;
      params.modHold = this.getModHold(holdModEnv, keynumToModEnvHold);
    },
    decayModEnv: (
      params: Partial<VoiceParams>,
      generators: GeneratorParams,
    ) => {
      const { decayModEnv, keynumToModEnvDecay } = generators;
      params.modDecay = this.getModDecay(decayModEnv, keynumToModEnvDecay);
    },
    sustainModEnv: (
      params: Partial<VoiceParams>,
      generators: GeneratorParams,
    ) => {
      params.modSustain = generators.sustainModEnv / 1000;
    },
    releaseModEnv: (
      params: Partial<VoiceParams>,
      generators: GeneratorParams,
    ) => {
      params.modRelease = timecentToSecond(generators.releaseModEnv);
    },
    keynumToModEnvHold: (
      params: Partial<VoiceParams>,
      generators: GeneratorParams,
    ) => {
      const { holdModEnv, keynumToModEnvHold } = generators;
      params.modHold = this.getModHold(holdModEnv, keynumToModEnvHold);
    },
    keynumToModEnvDecay: (
      params: Partial<VoiceParams>,
      generators: GeneratorParams,
    ) => {
      const { decayModEnv, keynumToModEnvDecay } = generators;
      params.modDecay = this.getModDecay(decayModEnv, keynumToModEnvDecay);
    },
    delayVolEnv: (
      params: Partial<VoiceParams>,
      generators: GeneratorParams,
    ) => {
      params.volDelay = timecentToSecond(generators.delayVolEnv);
    },
    attackVolEnv: (
      params: Partial<VoiceParams>,
      generators: GeneratorParams,
    ) => {
      params.volAttack = timecentToSecond(generators.attackVolEnv);
    },
    holdVolEnv: (params: Partial<VoiceParams>, generators: GeneratorParams) => {
      const { holdVolEnv, keynumToVolEnvHold } = generators;
      params.volHold = this.getVolHold(holdVolEnv, keynumToVolEnvHold);
    },
    decayVolEnv: (
      params: Partial<VoiceParams>,
      generators: GeneratorParams,
    ) => {
      const { decayVolEnv, keynumToVolEnvDecay } = generators;
      params.volDecay = this.getVolDecay(decayVolEnv, keynumToVolEnvDecay);
    },
    sustainVolEnv: (
      params: Partial<VoiceParams>,
      generators: GeneratorParams,
    ) => {
      params.volSustain = generators.sustainVolEnv / 1000;
    },
    releaseVolEnv: (
      params: Partial<VoiceParams>,
      generators: GeneratorParams,
    ) => {
      params.volRelease = timecentToSecond(generators.releaseVolEnv);
    },
    keynumToVolEnvHold: (
      params: Partial<VoiceParams>,
      generators: GeneratorParams,
    ) => {
      const { holdVolEnv, keynumToVolEnvHold } = generators;
      params.modHold = this.getVolHold(holdVolEnv, keynumToVolEnvHold);
    },
    keynumToVolEnvDecay: (
      params: Partial<VoiceParams>,
      generators: GeneratorParams,
    ) => {
      const { decayVolEnv, keynumToVolEnvDecay } = generators;
      params.modDecay = this.getVolDecay(decayVolEnv, keynumToVolEnvDecay);
    },
    // instrument
    // keyRange
    // velRange
    // startloopAddrsCoarseOffset
    // keynum
    // velocity
    initialAttenuation: (
      params: Partial<VoiceParams>,
      generators: GeneratorParams,
    ) => {
      params.initialAttenuation = generators.initialAttenuation;
    },
    // endloopAddrsCoarseOffset
    coarseTune: (params: Partial<VoiceParams>, generators: GeneratorParams) => {
      params.playbackRate = this.getPlaybackRate(generators);
    },
    fineTune: (params: Partial<VoiceParams>, generators: GeneratorParams) => {
      params.playbackRate = this.getPlaybackRate(generators);
    },
    // sampleID
    scaleTuning: (
      params: Partial<VoiceParams>,
      generators: GeneratorParams,
    ) => {
      params.playbackRate = this.getPlaybackRate(generators);
    },
    // exclusiveClass
    // overridingRootKey
  } as const;

  getParams(
    controllerType: number,
    controllerValue: number,
    controllerValues: Float32Array,
  ) {
    const params: Partial<VoiceParams> = {};
    const generators = structuredClone(this.generators);
    const updatedParams = this.getGeneratorParams(
      controllerType,
      controllerValue,
      controllerValues,
    );
    const updatedKeys = Object.keys(updatedParams) as ValueGeneratorKey[];
    for (const updatedKey of updatedKeys) {
      generators[updatedKey] = updatedParams[updatedKey]!;
    }
    for (const updatedKey of updatedKeys) {
      this.voiceHandlers[updatedKey](params, generators);
    }
    return params;
  }

  getAllParams(controllerValues: Float32Array) {
    const params: Partial<VoiceParams> = {
      start: this.generators.startAddrsCoarseOffset * 32768 +
        this.generators.startAddrsOffset,
      end: this.generators.endAddrsCoarseOffset * 32768 +
        this.generators.endAddrsOffset,
      loopStart: this.sampleHeader.loopStart +
        this.generators.startloopAddrsCoarseOffset * 32768 +
        this.generators.startloopAddrsOffset,
      loopEnd: this.sampleHeader.loopEnd +
        this.generators.endloopAddrsCoarseOffset * 32768 +
        this.generators.endloopAddrsOffset,
      sample: this.sample,
      sampleRate: this.sampleHeader.sampleRate,
      sampleName: this.sampleHeader.sampleName,
      sampleModes: this.generators.sampleModes,
      exclusiveClass: this.generators.exclusiveClass,
    };
    const generators = this.getTransformedGeneratorParams(controllerValues);
    for (let i = 0; i < ValueGeneratorKeys.length; i++) {
      const generatorKey = ValueGeneratorKeys[i];
      this.voiceHandlers[generatorKey](params, generators);
    }
    return params as VoiceParams;
  }
}

export interface VoiceParams {
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
  playbackRate: number;
  // sampleID: number;
  sample: Uint8Array;
  sampleRate: number;
  sampleName: string;
  sampleModes: number;
  // scaleTuning: number;
  exclusiveClass: number;
  // overridingRootKey: number;
}
