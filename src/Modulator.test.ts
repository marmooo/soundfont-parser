import { assertEquals } from "jsr:@std/assert";
import { ModulatorSource } from "./Modulator.ts";

const testData: [number, ModulatorSource][] = [
  [0x0502, new ModulatorSource(1, 0, 1, 0, 2)],
  [0x0102, new ModulatorSource(0, 0, 1, 0, 2)],
  [0x000d, new ModulatorSource(0, 0, 0, 0, 13)],
  [0x0081, new ModulatorSource(0, 0, 0, 1, 1)],
  [0x0587, new ModulatorSource(1, 0, 1, 1, 7)],
  [0x028a, new ModulatorSource(0, 1, 0, 1, 10)],
  [0x058b, new ModulatorSource(1, 0, 1, 1, 11)],
  [0x00db, new ModulatorSource(0, 0, 0, 1, 91)],
  [0x00dd, new ModulatorSource(0, 0, 0, 1, 93)],
  [0x020e, new ModulatorSource(0, 1, 0, 0, 14)],
];

for (let i = 0; i < testData.length; i++) {
  const [sourceOper, answer] = testData[i];
  const parsed = ModulatorSource.parse(sourceOper);
  assertEquals(parsed.type, answer.type);
  assertEquals(parsed.polarity, answer.polarity);
  assertEquals(parsed.direction, answer.direction);
  assertEquals(parsed.cc, answer.cc);
  assertEquals(parsed.index, answer.index);
}
