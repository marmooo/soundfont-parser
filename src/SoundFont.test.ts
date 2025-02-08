import {
  assertAlmostEquals,
  assertEquals,
  assertNotEquals,
} from "jsr:@std/assert";
import { parse } from "./Parser.ts";
import { convertTime, SoundFont } from "./SoundFont.ts";

const tolerance = 5e-3;
const input = Deno.readFileSync("./fixture/TestSoundFont.sf2");
const parsed = parse(input);
const soundFont = new SoundFont(parsed);

Deno.test("should create Preset Zone", () => {
  const zone = soundFont.getPresetZone(0);
  assertNotEquals(zone, null);
});
Deno.test("should create Instrument Zone", () => {
  const ids = soundFont.getInstrumentZoneIndexes(1);

  // 最初に Global Zone が入っている
  const zone1 = soundFont.getInstrumentZone(ids[0]);
  assertEquals(zone1.sampleID, undefined); // Global Zone は sample ID を持たない
  assertAlmostEquals(
    convertTime(zone1.attackVolEnv ?? 0),
    0.123,
    tolerance,
    "attackVolEnv",
  );
  assertAlmostEquals(
    convertTime(zone1.decayVolEnv ?? 0),
    0.234,
    tolerance,
    "decayVolEnv",
  );

  const zone2 = soundFont.getInstrumentZone(ids[1]);
  assertNotEquals(zone2.sampleID, undefined); // Instrument Zone は sample ID を持つ
});
Deno.test("should create InstrumentKey", () => {
  const key = soundFont.getInstrumentKey(0, 0, 40, 100)!;
  assertNotEquals(key, null);
  assertEquals(key.sampleName, "crash");
  assertEquals(key.keyRange.lo, 40);
  assertEquals(key.keyRange.hi, 40);

  assertAlmostEquals(key.volAttack, 0.2, tolerance, "volAttack");
  assertAlmostEquals(key.volDecay, 0.4, tolerance, "volDecay");
  assertAlmostEquals(key.volRelease, 0.6, tolerance, "volRelease");

  assertAlmostEquals(key.modAttack, 0.2, tolerance, "modAttack");
  assertAlmostEquals(key.modDecay, 0.4, tolerance, "modDecay");
  assertAlmostEquals(key.modSustain, 0.5 / 100, tolerance, "modSustain");
  assertAlmostEquals(key.modRelease, 0.6, tolerance, "modRelease");
  assertAlmostEquals(key.modEnvToPitch, 1 / 100, tolerance, "modEnvToPitch");
  assertAlmostEquals(key.modEnvToFilterFc, 2, tolerance, "modEnvToFilterFc");
});
Deno.test("should apply Global Instrument Zone", () => {
  const key = soundFont.getInstrumentKey(0, 1, 40, 100)!;
  assertAlmostEquals(key.volAttack, 0.123, tolerance); // Global の値が使われている
  assertAlmostEquals(key.volDecay, 0.345, tolerance); // Global の値が上書きされている
});
