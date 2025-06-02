export class ModulatorSource {
  constructor(
    public type: number,
    public polarity: number,
    public direction: number,
    public cc: number,
    public index: number,
  ) {}

  get controllerType() {
    return this.cc << 8 | this.index;
  }

  static parse(sourceOper: number) {
    const type = sourceOper >> 10 & 63;
    const index = sourceOper & 127;
    const cc = sourceOper >> 7 & 1;
    const direction = sourceOper >> 8 & 1;
    const polarity = sourceOper >> 9 & 1;
    return new ModulatorSource(type, polarity, direction, cc, index);
  }

  map(normalizedValue: number): number {
    let v = normalizedValue; // [0-1]
    switch (this.type) {
      case 0: // linear
        break;
      case 1: // concave
        v = Math.sqrt(v);
        break;
      case 2: // convex
        v = v * v;
        break;
      case 3: // switch
        v = v >= 0.5 ? 1 : 0;
        break;
      default: // treat as linear
        console.warn(`unexpected type: ${this.type}`);
        break;
    }
    // polarity (0: unipolar, 1: bipolar)
    if (this.polarity === 1) {
      v = (v - 0.5) * 2; // -1 to +1
    }
    // direction (0: positive, 1: negative)
    if (this.direction === 1) {
      v *= -1;
    }
    return v;
  }
}
