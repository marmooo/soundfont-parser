import { copySync } from "jsr:@std/fs";
import { build, emptyDir } from "jsr:@deno/dnt";

await emptyDir("./npm");

await build({
  entryPoints: ["./src/mod.ts"],
  outDir: "./npm",
  compilerOptions: {
    lib: ["ESNext"],
  },
  shims: {
    deno: true,
  },
  package: {
    name: "@marmooo/soundfont-parser",
    version: "0.0.3",
    description: "A SoundFont (SF2, SF3) parser.",
    license: "MIT",
    repository: {
      type: "git",
      url: "git+https://github.com/marmooo/soundfont-parser.git",
    },
    bugs: {
      url: "https://github.com/marmooo/soundfont-parser/issues",
    },
  },
  postBuild() {
    Deno.copyFileSync("LICENSE", "npm/LICENSE");
    Deno.copyFileSync("README.md", "npm/README.md");
    copySync("fixture", "npm/esm/fixture");
    copySync("fixture", "npm/script/fixture");
  },
});
