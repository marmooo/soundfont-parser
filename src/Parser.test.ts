import { parse } from "./Parser.ts";
import { assertEquals } from "@std/assert";

const input = Deno.readFileSync("./fixture/TestSoundFont.sf2");
const parser = parse(input);

Deno.test("should parse INFO", () => {
  assertEquals(parser.info.comment, "This is comment");
  assertEquals(parser.info.copyright, "Public Domain");
  assertEquals(parser.info.creationDate, "Nov 28, 2017");
  assertEquals(parser.info.engineer, "ryohey");
  assertEquals(parser.info.name, "TestSoundFont");
  assertEquals(parser.info.product, "PRDCT");
  assertEquals(parser.info.software, "Polyphone");
  assertEquals(parser.info.soundEngine, "EMU8000");
  assertEquals(parser.info.version.major, 2);
  assertEquals(parser.info.version.minor, 0);

  // FIXME: I don't know how to set these values to the soundfont
  // assertEquals(parser.info.romName, "");
  // assertEquals(parser.info.romVersion, "0.00");
});

Deno.test("should parse instruments", () => {
  assertEquals(parser.instruments.length, 2);
  assertEquals(parser.instruments[0].instrumentName, "tr909");
  assertEquals(parser.instruments[1].instrumentName, "tr909-mod");
});

Deno.test("should parse samples", () => {
  assertEquals(parser.samples.length, 5);
  assertEquals(parser.sampleHeaders.length, 5);
  assertEquals(parser.sampleHeaders[0].sampleName, "bassdrum1");
  assertEquals(parser.sampleHeaders[0].sampleRate, 44100);
  assertEquals(parser.sampleHeaders[0].originalPitch, 76);
  assertEquals(parser.sampleHeaders[0].pitchCorrection, 6);
});

Deno.test("should parse presets", () => {
  assertEquals(parser.presetHeaders.length, 2);
  assertEquals(parser.presetHeaders[0].presetName, "tr909");
  assertEquals(parser.presetHeaders[1].presetName, "tr909-mod");
});
