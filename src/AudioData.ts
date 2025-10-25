import { SampleHeader } from "./Structs.ts";

const AudioDataTypes = ["pcm16", "pcm24", "compressed"] as const;
type AudioDataType = typeof AudioDataTypes[number];
const AudioTypesSet = new Set(AudioDataTypes);

export class AudioData {
  type: AudioDataType;
  sampleHeader: SampleHeader;
  data: Uint8Array<ArrayBuffer>;

  constructor(
    type: AudioDataType,
    sampleHeader: SampleHeader,
    data: Uint8Array<ArrayBuffer>,
  ) {
    if (!AudioTypesSet.has(type)) {
      throw new Error(`Invalid AudioDataType: ${type}`);
    }
    this.type = type;
    this.sampleHeader = sampleHeader;
    this.data = data;
  }

  decodePCM(data: Uint8Array): Float32Array<ArrayBuffer> {
    const { type } = this;
    if (type === "pcm16") {
      const bytesPerSample = 2;
      const frameCount = data.byteLength / bytesPerSample;
      const result = new Float32Array(frameCount);
      const src = new Int16Array(
        data.buffer,
        data.byteOffset,
        data.byteLength / bytesPerSample,
      );
      for (let i = 0; i < frameCount; i++) {
        result[i] = src[i] / 32768;
      }
      return result;
    } else {
      const bytesPerSample = 3;
      const frameCount = data.byteLength / bytesPerSample;
      const result = new Float32Array(frameCount);
      for (let i = 0; i < frameCount; i++) {
        const idx = i * bytesPerSample;
        let val = data[idx] | (data[idx + 1] << 8) | (data[idx + 2] << 16);
        if (val & 0x800000) val |= 0xff000000;
        result[i] = val / 8388608;
      }
      return result;
    }
  }

  async toAudioBuffer(
    audioContext: AudioContext,
    start: number,
    end: number,
  ): Promise<AudioBuffer> {
    if (this.type === "compressed") {
      const slice = this.data.slice(start, end);
      return await audioContext.decodeAudioData(slice.buffer);
    } else {
      const subarray = this.data.subarray(start, end);
      const pcm = this.decodePCM(subarray);
      const buffer = new AudioBuffer({
        numberOfChannels: 1,
        length: pcm.length,
        sampleRate: this.sampleHeader.sampleRate,
      });
      buffer.getChannelData(0).set(pcm);
      return buffer;
    }
  }
}
