# @marmooo/soundfont-parser

A SoundFont (SF2, SF3) parser.

## Usage

```
import { parse, SoundFont } from "@marmooo/soundfont-parser";

const file = Deno.readFileSync("soundfont.sf3");
const parsed = parse(file);
const soundFont = new SoundFont(parsed);
```

## License

MIT

## Credits

This library is based on following libraries.

- [gree/sf2synth.js](https://github.com/gree/sf2synth.js) writty by imaya / GREE
  Inc.
- [ryohey/sf2synth.js](https://github.com/ryohey/sf2synth.js) written by ryohey

## References

The SoundFont 3 format (SF3) is an unofficial extension of the SoundFont 2
format (SF2). This library is based on following articles.

- [SoundFont® Technical Specification](https://www.synthfont.com/sfspec24.pdf)
- [SoundFont3Format](https://github.com/FluidSynth/fluidsynth/wiki/SoundFont3Format)
