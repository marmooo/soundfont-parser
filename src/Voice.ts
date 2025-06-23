import {
  DefaultInstrumentZone,
  InstrumentGeneratorParams,
  isValueGenerator,
  NonRangeGeneratorKey,
  ValueGeneratorKey,
  ValueGeneratorKeys,
} from "./Generator.ts";
import { GeneratorKeys } from "./Constants.ts";
import { ModulatorList, SampleHeader } from "./Structs.ts";

export function timecentToSecond(value: number) {
  return Math.pow(2, value / 1200);
}

export class Voice {
  controllerToDestinations = new Map<number, Set<number>>();
  destinationToModulators = new Map<number, ModulatorList[]>();

  constructor(
    public key: number,
    public generators: InstrumentGeneratorParams,
    public modulators: ModulatorList[],
    public sample: Uint8Array,
    public sampleHeader: SampleHeader,
  ) {
    this.setControllerToDestinations();
    this.setDestinationToModulators();
  }

  setControllerToDestinations() {
    for (let i = 0; i < this.modulators.length; i++) {
      const modulator = this.modulators[i];
      const controllerType = modulator.sourceOper.controllerType;
      const destinationOper = modulator.destinationOper;
      const list = this.controllerToDestinations.get(controllerType);
      if (list) {
        list.add(modulator.destinationOper);
      } else {
        this.controllerToDestinations.set(controllerType, new Set([destinationOper]));
      }
    }
  }

  setDestinationToModulators() {
    for (let i = 0; i < this.modulators.length; i++) {
      const modulator = this.modulators[i];
      const generatorKey = modulator.destinationOper;
      const list = this.destinationToModulators.get(generatorKey);
      if (list) {
        list.push(modulator);
      } else {
        this.destinationToModulators.set(generatorKey, [modulator]);
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

  getPlaybackRate(generators: InstrumentGeneratorParams) {
    const coarseTune = this.clamp("coarseTune", generators);
    const fineTune = this.clamp("fineTune", generators) / 100;
    const overridingRootKey = this.clamp("overridingRootKey", generators);
    const scaleTuning = this.clamp("scaleTuning", generators) / 100;
    const tune = coarseTune + fineTune;
    const rootKey = overridingRootKey === -1
      ? this.sampleHeader.originalPitch
      : overridingRootKey;
    const basePitch = tune + this.sampleHeader.pitchCorrection / 100 - rootKey;
    return Math.pow(Math.pow(2, 1 / 12), (this.key + basePitch) * scaleTuning);
  }

  transformParams(
    controllerType: number,
    controllerState: Float32Array,
  ) {
    const params: Partial<Record<ValueGeneratorKey, number>> = {};
    const destinations = this.controllerToDestinations.get(controllerType);
    if (!destinations) return params;
    for (const destinationOper of destinations) {
      const generatorKey = GeneratorKeys[destinationOper];
      if (!generatorKey) continue;
      if (!isValueGenerator(generatorKey)) continue;
      const modulators = this.destinationToModulators.get(destinationOper);
      if (!modulators) continue;
      params[generatorKey] = this.generators[generatorKey];
      for (const modulator of modulators) {
        const source = modulator.sourceOper;
        const primary = source.map(controllerState[source.controllerType]);
        let secondary = 1;
        const amountSource = modulator.amountSourceOper;
        if (!(amountSource.cc === 0 && amountSource.index === 0)) {
          const amount = controllerState[amountSource.controllerType];
          secondary = amountSource.map(amount);
        }
        const summingValue = modulator.transform(primary * secondary);
        if (Number.isNaN(summingValue)) continue;
        params[generatorKey] += summingValue;
      }
    }
    return params;
  }

  transformAllParams(controllerState: Float32Array) {
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
      const summingValue = modulator.transform(primary * secondary);
      if (Number.isNaN(summingValue)) continue;
      params[generatorKey] += summingValue;
    }
    return params;
  }

  clamp(
    key: NonRangeGeneratorKey,
    generators: InstrumentGeneratorParams,
  ) {
    return DefaultInstrumentZone[key].clamp(generators[key]);
  }

  voiceHandlers: {
    [K in ValueGeneratorKey]: (
      params: Partial<VoiceParams>,
      generators: InstrumentGeneratorParams,
    ) => void;
  } = {
    // startAddrsOffset
    // endAddrsOffset
    // startloopAddrsOffset
    // endloopAddrsOffset
    modLfoToPitch: (
      params: Partial<VoiceParams>,
      generators: InstrumentGeneratorParams,
    ) => {
      params.modLfoToPitch = this.clamp("modLfoToPitch", generators);
    },
    vibLfoToPitch: (
      params: Partial<VoiceParams>,
      generators: InstrumentGeneratorParams,
    ) => {
      params.vibLfoToPitch = this.clamp("vibLfoToPitch", generators);
    },
    modEnvToPitch: (
      params: Partial<VoiceParams>,
      generators: InstrumentGeneratorParams,
    ) => {
      params.modEnvToPitch = this.clamp("modEnvToPitch", generators);
    },
    initialFilterFc: (
      params: Partial<VoiceParams>,
      generators: InstrumentGeneratorParams,
    ) => {
      params.initialFilterFc = this.clamp("initialFilterFc", generators);
    },
    initialFilterQ: (
      params: Partial<VoiceParams>,
      generators: InstrumentGeneratorParams,
    ) => {
      params.initialFilterQ = this.clamp("initialFilterQ", generators);
    },
    modLfoToFilterFc: (
      params: Partial<VoiceParams>,
      generators: InstrumentGeneratorParams,
    ) => {
      params.modLfoToFilterFc = this.clamp("modLfoToFilterFc", generators);
    },
    modEnvToFilterFc: (
      params: Partial<VoiceParams>,
      generators: InstrumentGeneratorParams,
    ) => {
      params.modEnvToFilterFc = this.clamp("modEnvToFilterFc", generators);
    },
    // endAddrsCoarseOffset
    modLfoToVolume: (
      params: Partial<VoiceParams>,
      generators: InstrumentGeneratorParams,
    ) => {
      params.modLfoToVolume = this.clamp("modLfoToVolume", generators);
    },
    chorusEffectsSend: (
      params: Partial<VoiceParams>,
      generators: InstrumentGeneratorParams,
    ) => {
      params.chorusEffectsSend = this.clamp("chorusEffectsSend", generators) /
        1000;
    },
    reverbEffectsSend: (
      params: Partial<VoiceParams>,
      generators: InstrumentGeneratorParams,
    ) => {
      params.reverbEffectsSend = this.clamp("reverbEffectsSend", generators) /
        1000;
    },
    pan: (
      params: Partial<VoiceParams>,
      generators: InstrumentGeneratorParams,
    ) => {
      params.pan = this.clamp("pan", generators) / 1000;
    },
    delayModLFO: (
      params: Partial<VoiceParams>,
      generators: InstrumentGeneratorParams,
    ) => {
      params.delayModLFO = timecentToSecond(
        this.clamp("delayModLFO", generators),
      );
    },
    freqModLFO: (
      params: Partial<VoiceParams>,
      generators: InstrumentGeneratorParams,
    ) => {
      params.freqModLFO = this.clamp("freqModLFO", generators);
    },
    delayVibLFO: (
      params: Partial<VoiceParams>,
      generators: InstrumentGeneratorParams,
    ) => {
      params.delayVibLFO = timecentToSecond(
        this.clamp("delayVibLFO", generators),
      );
    },
    freqVibLFO: (
      params: Partial<VoiceParams>,
      generators: InstrumentGeneratorParams,
    ) => {
      params.freqVibLFO = this.clamp("freqVibLFO", generators);
    },
    delayModEnv: (
      params: Partial<VoiceParams>,
      generators: InstrumentGeneratorParams,
    ) => {
      params.modDelay = timecentToSecond(this.clamp("delayModEnv", generators));
    },
    attackModEnv: (
      params: Partial<VoiceParams>,
      generators: InstrumentGeneratorParams,
    ) => {
      params.modAttack = timecentToSecond(
        this.clamp("attackModEnv", generators),
      );
    },
    holdModEnv: (
      params: Partial<VoiceParams>,
      generators: InstrumentGeneratorParams,
    ) => {
      const holdModEnv = this.clamp("holdModEnv", generators);
      const keynumToModEnvHold = this.clamp("keynumToModEnvHold", generators);
      params.modHold = this.getModHold(holdModEnv, keynumToModEnvHold);
    },
    decayModEnv: (
      params: Partial<VoiceParams>,
      generators: InstrumentGeneratorParams,
    ) => {
      const decayModEnv = this.clamp("decayModEnv", generators);
      const keynumToModEnvDecay = this.clamp("keynumToModEnvDecay", generators);
      params.modDecay = this.getModDecay(decayModEnv, keynumToModEnvDecay);
    },
    sustainModEnv: (
      params: Partial<VoiceParams>,
      generators: InstrumentGeneratorParams,
    ) => {
      params.modSustain = this.clamp("sustainModEnv", generators) / 1000;
    },
    releaseModEnv: (
      params: Partial<VoiceParams>,
      generators: InstrumentGeneratorParams,
    ) => {
      params.modRelease = timecentToSecond(
        this.clamp("releaseModEnv", generators),
      );
    },
    keynumToModEnvHold: (
      params: Partial<VoiceParams>,
      generators: InstrumentGeneratorParams,
    ) => {
      const holdModEnv = this.clamp("holdModEnv", generators);
      const keynumToModEnvHold = this.clamp("keynumToModEnvHold", generators);
      params.modHold = this.getModHold(holdModEnv, keynumToModEnvHold);
    },
    keynumToModEnvDecay: (
      params: Partial<VoiceParams>,
      generators: InstrumentGeneratorParams,
    ) => {
      const decayModEnv = this.clamp("decayModEnv", generators);
      const keynumToModEnvDecay = this.clamp("keynumToModEnvDecay", generators);
      params.modDecay = this.getModDecay(decayModEnv, keynumToModEnvDecay);
    },
    delayVolEnv: (
      params: Partial<VoiceParams>,
      generators: InstrumentGeneratorParams,
    ) => {
      params.volDelay = timecentToSecond(this.clamp("delayVolEnv", generators));
    },
    attackVolEnv: (
      params: Partial<VoiceParams>,
      generators: InstrumentGeneratorParams,
    ) => {
      params.volAttack = timecentToSecond(
        this.clamp("attackVolEnv", generators),
      );
    },
    holdVolEnv: (
      params: Partial<VoiceParams>,
      generators: InstrumentGeneratorParams,
    ) => {
      const holdVolEnv = this.clamp("holdVolEnv", generators);
      const keynumToVolEnvHold = this.clamp("keynumToVolEnvHold", generators);
      params.volHold = this.getVolHold(holdVolEnv, keynumToVolEnvHold);
    },
    decayVolEnv: (
      params: Partial<VoiceParams>,
      generators: InstrumentGeneratorParams,
    ) => {
      const decayVolEnv = this.clamp("decayVolEnv", generators);
      const keynumToVolEnvDecay = this.clamp("keynumToVolEnvDecay", generators);
      params.volDecay = this.getVolDecay(decayVolEnv, keynumToVolEnvDecay);
    },
    sustainVolEnv: (
      params: Partial<VoiceParams>,
      generators: InstrumentGeneratorParams,
    ) => {
      params.volSustain = this.clamp("sustainVolEnv", generators) / 1000;
    },
    releaseVolEnv: (
      params: Partial<VoiceParams>,
      generators: InstrumentGeneratorParams,
    ) => {
      params.volRelease = timecentToSecond(
        this.clamp("releaseVolEnv", generators),
      );
    },
    keynumToVolEnvHold: (
      params: Partial<VoiceParams>,
      generators: InstrumentGeneratorParams,
    ) => {
      const holdVolEnv = this.clamp("holdVolEnv", generators);
      const keynumToVolEnvHold = this.clamp("keynumToVolEnvHold", generators);
      params.modHold = this.getVolHold(holdVolEnv, keynumToVolEnvHold);
    },
    keynumToVolEnvDecay: (
      params: Partial<VoiceParams>,
      generators: InstrumentGeneratorParams,
    ) => {
      const decayVolEnv = this.clamp("decayVolEnv", generators);
      const keynumToVolEnvDecay = this.clamp("keynumToVolEnvDecay", generators);
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
      generators: InstrumentGeneratorParams,
    ) => {
      params.initialAttenuation = this.clamp("initialAttenuation", generators);
    },
    // endloopAddrsCoarseOffset
    coarseTune: (
      params: Partial<VoiceParams>,
      generators: InstrumentGeneratorParams,
    ) => {
      params.playbackRate = this.getPlaybackRate(generators);
    },
    fineTune: (
      params: Partial<VoiceParams>,
      generators: InstrumentGeneratorParams,
    ) => {
      params.playbackRate = this.getPlaybackRate(generators);
    },
    // sampleID
    scaleTuning: (
      params: Partial<VoiceParams>,
      generators: InstrumentGeneratorParams,
    ) => {
      params.playbackRate = this.getPlaybackRate(generators);
    },
    // exclusiveClass
    // overridingRootKey
  } as const;

  getParams(controllerType: number, controllerState: Float32Array) {
    const params: Partial<VoiceParams> = {};
    const generators = structuredClone(this.generators);
    const updatedParams = this.transformParams(
      controllerType,
      controllerState,
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
      exclusiveClass: this.clamp("exclusiveClass", this.generators),
    };
    const generators = this.transformAllParams(controllerValues);
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
