import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, it } from "node:test";

const PLUGIN = "@house-rules/rules";
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const readJson = (path) => JSON.parse(read(path));
const require = createRequire(import.meta.url);

describe("thin configs over the house plugin", () => {
  it("tsconfig.base.json extends the Effect preset and does not replace its plugin block", () => {
    const tsconfig = readJson("tsconfig.base.json");
    assert.equal(tsconfig.extends, `${PLUGIN}/tsconfig/effect.json`);
    assert.equal(tsconfig.compilerOptions?.plugins, undefined);
  });

  it("biome.json extends the Biome preset", () => {
    assert.deepEqual(readJson("biome.json").extends, [`${PLUGIN}/biome`]);
  });

  it(".dependency-cruiser.cjs builds on layout() and keeps every layout rule unchanged", () => {
    assert.match(
      read(".dependency-cruiser.cjs"),
      new RegExp(`require\\("${PLUGIN}/dependency-cruiser"\\)`),
    );
    const { layout } = require(`${PLUGIN}/dependency-cruiser`);
    const config = require("../.dependency-cruiser.cjs");
    for (const rule of layout({ scope: "@hosti/" }).forbidden) {
      const local = config.forbidden.find(({ name }) => name === rule.name);
      assert.deepEqual(local, rule, `layout rule ${rule.name}`);
    }
  });

  it(".dependency-cruiser.cjs excludes only the in-repo plugin on top of the preset's excludes", () => {
    const { layout } = require(`${PLUGIN}/dependency-cruiser`);
    const config = require("../.dependency-cruiser.cjs");
    const preset = layout({ scope: "@hosti/" }).options.exclude.path;
    assert.equal(config.options.exclude.path, `${preset}|^packages/rules/`);
  });

  it("the root uses the in-repo plugin as a workspace package", () => {
    assert.equal(
      readJson("package.json").devDependencies[PLUGIN],
      `workspace:${readJson("packages/rules/package.json").version}`,
    );
    assert.equal(readJson("packages/rules/package.json").name, PLUGIN);
  });

  it("the pins script runs the plugin's bin", () => {
    assert.equal(readJson("package.json").scripts.pins, "house-rules-pins");
  });
});
