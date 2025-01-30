import { assertEquals, assertNotEquals } from "jsr:@std/assert";
import { parse } from "./Parser.ts";
import { convertTime, SoundFont } from "./SoundFont.ts";

Deno.test("SoundFont", () => {
  const input = Deno.readFileSync("./fixture/TestSoundFont.sf2");
  const parsed = parse(input);
  const soundFont = new SoundFont(parsed);

  assertNotEquals(soundFont, null);

  Deno.test("should create Preset Zone", () => {
    const zone = soundFont.getPresetZone(0);
    assertNotEquals(zone, null);
  });

  Deno.test("should create Instrument Zone", () => {
    const ids = soundFont.getInstrumentZoneIndexes(1);

    // 最初に Global Zone が入っている
    const zone1 = soundFont.getInstrumentZone(ids[0]);
    assertEquals(zone1.sampleID, undefined); // Global Zone は sample ID を持たない
    assertEquals(convertTime(zone1.attackVolEnv ?? 0), 0.123, "attackVolEnv");
    assertEquals(convertTime(zone1.decayVolEnv ?? 0), 0.234, "decayVolEnv");

    const zone2 = soundFont.getInstrumentZone(ids[1]);
    assertNotEquals(zone2.sampleID, undefined); // Instrument Zone は sample ID を持つ
  });

  Deno.test("should create InstrumentKey", () => {
    const key = soundFont.getInstrumentKey(0, 0, 40, 100)!;
    assertNotEquals(key, null);
    assertEquals(key.sampleName, "crash");
    assertEquals(key.keyRange.lo, 40);
    assertEquals(key.keyRange.hi, 40);

    assertEquals(key.volAttack, 0.2, "volAttack");
    assertEquals(key.volDecay, 0.4, "volDecay");
    assertEquals(key.volRelease, 0.6, "volRelease");

    assertEquals(key.modAttack, 0.2, "modAttack");
    assertEquals(key.modDecay, 0.4, "modDecay");
    assertEquals(key.modSustain, 0.5 / 100, "modSustain");
    assertEquals(key.modRelease, 0.6, "modRelease");
    assertEquals(key.modEnvToPitch, 1 / 100, "modEnvToPitch");
    assertEquals(key.modEnvToFilterFc, 2, "modEnvToFilterFc");
  });

  Deno.test("should apply Global Instrument Zone", () => {
    const key = soundFont.getInstrumentKey(0, 1, 40, 100)!;
    assertEquals(key.volAttack, 0.123); // Global の値が使われている
    assertEquals(key.volDecay, 0.345); // Global の値が上書きされている
  });
});
