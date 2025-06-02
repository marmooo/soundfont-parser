import {
  assertAlmostEquals,
  assertEquals,
  assertNotEquals,
} from "jsr:@std/assert";
import { parse } from "./Parser.ts";
import { timecentToSecond } from "./Voice.ts";
import { SoundFont } from "./SoundFont.ts";
import { createInstrumentGeneratorObject } from "./Generator.ts";

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

  const globalZone = createInstrumentGeneratorObject(bag[0]);
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

  const instrumentZone = createInstrumentGeneratorObject(bag[1]);
  assertNotEquals(instrumentZone.sampleID, undefined);
});
Deno.test("should create Voice", () => {
  const voice = soundFont.getVoice(0, 0, 40, 100)!;
  const params = voice.getAllParams(new Float32Array(256));
  assertNotEquals(params, null);
  assertEquals(params.sampleName, "crash");

  assertAlmostEquals(params.volAttack, 0.2, tolerance, "volAttack");
  assertAlmostEquals(params.volDecay, 0.4, tolerance, "volDecay");
  assertAlmostEquals(params.volRelease, 0.6, tolerance, "volRelease");

  assertAlmostEquals(params.modAttack, 0.2, tolerance, "modAttack");
  assertAlmostEquals(params.modDecay, 0.4, tolerance, "modDecay");
  assertAlmostEquals(params.modSustain, 0.5 / 100, tolerance, "modSustain");
  assertAlmostEquals(params.modRelease, 0.6, tolerance, "modRelease");
  assertAlmostEquals(params.modEnvToPitch, 1, tolerance, "modEnvToPitch");
  assertAlmostEquals(
    params.modEnvToFilterFc,
    2,
    tolerance,
    "modEnvToFilterFc",
  );
});
Deno.test("should apply Global Instrument Zone", () => {
  const voice = soundFont.getVoice(0, 1, 40, 100)!;
  const params = voice.getAllParams(new Float32Array(256));
  assertAlmostEquals(params.volAttack, 0.123, tolerance); // global zone value
  assertAlmostEquals(params.volDecay, 0.345, tolerance); // global zone value
});
