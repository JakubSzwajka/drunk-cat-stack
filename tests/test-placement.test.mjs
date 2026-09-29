import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const config = fileURLToPath(new URL("../.dependency-cruiser.cjs", import.meta.url));
const depcruise = fileURLToPath(new URL("../node_modules/.bin/depcruise", import.meta.url));

const BASE = {
  "packages/demo/src/index.ts": 'export { greet } from "./internal/greet.js";\n',
  "packages/demo/src/internal/greet.ts": 'export const greet = () => "hi";\n',
  "packages/demo/src/tests/demo.test.ts": 'import { greet } from "../index.js";\n\ngreet();\n',
};

const cruise = (extraFiles) => {
  const dir = mkdtempSync(join(tmpdir(), "test-placement-"));
  try {
    for (const [path, content] of Object.entries({ ...BASE, ...extraFiles })) {
      mkdirSync(join(dir, path, ".."), { recursive: true });
      writeFileSync(join(dir, path), content);
    }
    const result = spawnSync(depcruise, ["--config", config, "."], {
      cwd: dir,
      encoding: "utf8",
    });
    return { status: result.status, output: `${result.stdout}${result.stderr}` };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

describe("test placement rules", () => {
  it("accepts a test inside a tests folder that uses the public entry", () => {
    const result = cruise({});
    assert.equal(result.status, 0, result.output);
  });

  const misplaced = {
    "beside its source file": "packages/demo/src/greet.test.ts",
    "at the package root": "packages/demo/tests/greet.test.ts",
    "in a subfolder of tests": "packages/demo/src/tests/unit/greet.test.ts",
    "in a folder whose name only ends in tests": "packages/demo/src/unit-tests/greet.spec.ts",
  };
  for (const [where, path] of Object.entries(misplaced)) {
    it(`rejects a test ${where}`, () => {
      const result = cruise({ [path]: "export const placed = true;\n" });
      assert.notEqual(result.status, 0);
      assert.match(result.output, new RegExp(`tests-live-in-tests-dir: ${path}`));
    });
  }

  it("rejects a test that imports a package's internals", () => {
    const result = cruise({
      "packages/demo/src/tests/demo.test.ts":
        'import { greet } from "../internal/greet.js";\n\ngreet();\n',
    });
    assert.notEqual(result.status, 0);
    assert.match(
      result.output,
      /tests-do-not-import-internals: packages\/demo\/src\/tests\/demo\.test\.ts → packages\/demo\/src\/internal\/greet\.ts/,
    );
  });
});
