import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const FIXTURES = path.join(import.meta.dirname, "fixtures/presets");
const bin = (name) => path.join(repositoryRoot, "node_modules/.bin", name);
// TypeScript 7 is installed under an alias so the ESLint parser keeps its TypeScript 6 peer.
const tsc7 = path.join(repositoryRoot, "node_modules/typescript-7/bin/tsc");
const readJson = async (file) =>
  JSON.parse(await readFile(path.join(repositoryRoot, file), "utf8"));

// A consumer directory that resolves this package by name through node_modules, as an install would.
async function withConsumer(files, run) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "house-rules-presets-"));
  try {
    await mkdir(path.join(directory, "node_modules/@house-rules"), { recursive: true });
    await symlink(repositoryRoot, path.join(directory, "node_modules/@house-rules/rules"), "dir");
    for (const [name, content] of Object.entries(files)) {
      await mkdir(path.dirname(path.join(directory, name)), { recursive: true });
      await writeFile(
        path.join(directory, name),
        typeof content === "string" ? content : JSON.stringify(content),
      );
    }
    return await run((command, args) => {
      const result = spawnSync(command, args, { cwd: directory, encoding: "utf8" });
      return { status: result.status, output: `${result.stdout}${result.stderr}` };
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("strict.json plus effect.json equal drunk-cat-stack's tsconfig.base.json", async () => {
  const strict = await readJson("tsconfig/strict.json");
  const effect = await readJson("tsconfig/effect.json");
  const original = await readJson("tests/fixtures/presets/drunk-cat-stack.tsconfig.base.json");
  assert.equal(effect.extends, "./strict.json");
  assert.equal(strict.compilerOptions.plugins, undefined);
  assert.deepEqual(Object.keys(effect.compilerOptions), ["plugins"]);
  assert.deepEqual(
    { ...strict.compilerOptions, ...effect.compilerOptions },
    original.compilerOptions,
  );
});

test("the Biome preset equals drunk-cat-stack's biome.json without the consumer-owned files block", async () => {
  const preset = await readJson("biome/preset.json");
  const { files, ...original } = JSON.parse(
    await readFile(path.join(FIXTURES, "drunk-cat-stack.biome.json"), "utf8"),
  );
  assert.ok(files);
  assert.deepEqual(preset, original);
});

// tsc --showConfig omits `plugins`; the Effect diagnostics need @effect/tsgo and are proven in a consumer instead.
test("the preset tests run the TypeScript and Biome versions drunk-cat-stack pins", () => {
  assert.match(spawnSync(tsc7, ["--version"], { encoding: "utf8" }).stdout, /^Version 7\.0\.2\b/);
  assert.match(
    spawnSync(bin("biome"), ["--version"], { encoding: "utf8" }).stdout,
    /^Version: 2\.5\.14\b/,
  );
});

test("TypeScript resolves both tsconfig presets through package exports", async () => {
  for (const preset of ["strict", "effect"]) {
    const tsconfig = {
      extends: `@house-rules/rules/tsconfig/${preset}.json`,
      include: ["*.ts"],
    };
    await withConsumer(
      {
        "package.json": { type: "module" },
        "tsconfig.json": tsconfig,
        "clean.ts":
          "export const first = (values: readonly number[]): number | undefined => values[0];\n",
      },
      async (run) => {
        const shown = run(tsc7, ["--showConfig"]);
        assert.equal(shown.status, 0, shown.output);
        const { compilerOptions } = JSON.parse(shown.output);
        assert.equal(compilerOptions.strict, true);
        assert.equal(compilerOptions.noUncheckedIndexedAccess, true);
        assert.equal(compilerOptions.exactOptionalPropertyTypes, true);
        assert.equal(compilerOptions.noEmit, true);
        const clean = run(tsc7, ["--project", "tsconfig.json"]);
        assert.equal(clean.status, 0, clean.output);
      },
    );
  }
});

test("a consumer on the strict preset fails on an unchecked index access", async () => {
  await withConsumer(
    {
      "package.json": { type: "module" },
      "tsconfig.json": {
        extends: "@house-rules/rules/tsconfig/strict.json",
        include: ["*.ts"],
      },
      "unchecked.ts": "export const first = (values: readonly number[]): number => values[0];\n",
    },
    async (run) => {
      const result = run(tsc7, ["--project", "tsconfig.json"]);
      assert.notEqual(result.status, 0, result.output);
      assert.match(result.output, /unchecked\.ts\(1,\d+\): error TS2322/);
    },
  );
});

test("Biome extends the preset from the package and enforces its rules", async () => {
  await withConsumer(
    {
      "biome.json": { extends: ["@house-rules/rules/biome"] },
      "src/clean.ts": 'export { value } from "./value.js";\n',
      "src/value.ts": "export const value = 1;\n",
    },
    async (run) => {
      const clean = run(bin("biome"), ["check", "src"]);
      assert.equal(clean.status, 0, clean.output);
    },
  );
  await withConsumer(
    {
      "biome.json": { extends: ["@house-rules/rules/biome"] },
      "src/barrel.ts": 'export * from "./value.js";\n',
      "src/value.ts": "export const value: number | undefined = 1;\nexport const sure = value!;\n",
      "src/BadName.ts": "export const x = 1;\n",
    },
    async (run) => {
      const result = run(bin("biome"), ["lint", "src"]);
      assert.equal(result.status, 1, result.output);
      assert.match(result.output, /barrel\.ts:1:8 lint\/performance\/noReExportAll/);
      assert.match(result.output, /value\.ts:2:\d+ lint\/style\/noNonNullAssertion/);
      assert.match(result.output, /BadName\.ts lint\/style\/useFilenamingConvention/);
    },
  );
});
