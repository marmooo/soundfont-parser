import {
  assertAlmostEquals,
  assertEquals,
  assertNotEquals,
} from "jsr:@std/assert";
import { parse } from "./Parser.ts";
import { SoundFont, timecentToSecond } from "./SoundFont.ts";
import { createGeneratorObject } from "./GeneratorParams.ts";

const tolerance = 5e-3;
const input = Deno.readFileSync("./fixture/TestSoundFont.sf2");
const parsed = parse(input);
const soundFont = new SoundFont(parsed);

Deno.test("should create Preset Zone", () => {
  const zone = soundFont.getPresetGenerators(0);
  assertNotEquals(zone, null);
});
Deno.test("should create Instrument Zone", () => {
  const bag = soundFont.getInstrumentGenerators(1);

  const globalZone = createGeneratorObject(bag[0]);
  assertEquals(globalZone.sampleID, undefined);
  assertAlmostEquals(
    timecentToSecond(globalZone.attackVolEnv?.value ?? 0),
    0.123,
    tolerance,
    "attackVolEnv",
  );
  assertAlmostEquals(
    timecentToSecond(globalZone.decayVolEnv?.value ?? 0),
    0.234,
    tolerance,
    "decayVolEnv",
  );

  const instrumentZone = createGeneratorObject(bag[1]);
  assertNotEquals(instrumentZone.sampleID, undefined);
});
Deno.test("should create InstrumentKey", () => {
  const key = soundFont.getInstrumentKey(0, 0, 40, 100)!;
  assertNotEquals(key, null);
  assertEquals(key.sampleName, "crash");

  assertAlmostEquals(key.volAttack, 0.2, tolerance, "volAttack");
  assertAlmostEquals(key.volDecay, 0.4, tolerance, "volDecay");
  assertAlmostEquals(key.volRelease, 0.6, tolerance, "volRelease");

  assertAlmostEquals(key.modAttack, 0.2, tolerance, "modAttack");
  assertAlmostEquals(key.modDecay, 0.4, tolerance, "modDecay");
  assertAlmostEquals(key.modSustain, 0.5 / 100, tolerance, "modSustain");
  assertAlmostEquals(key.modRelease, 0.6, tolerance, "modRelease");
  assertAlmostEquals(key.modEnvToPitch, 1, tolerance, "modEnvToPitch");
  assertAlmostEquals(key.modEnvToFilterFc, 2, tolerance, "modEnvToFilterFc");
});
Deno.test("should apply Global Instrument Zone", () => {
  const key = soundFont.getInstrumentKey(0, 1, 40, 100)!;
  assertAlmostEquals(key.volAttack, 0.123, tolerance); // global zone value
  assertAlmostEquals(key.volDecay, 0.345, tolerance); // global zone value
});
