import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("../scripts/check-exact-pins.mjs", import.meta.url));

const checkManifest = (manifest) => {
  const dir = mkdtempSync(join(tmpdir(), "check-exact-pins-"));
  try {
    const path = join(dir, "package.json");
    writeFileSync(path, JSON.stringify(manifest));
    return spawnSync(process.execPath, [script, path], { encoding: "utf8" });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

describe("exact pin check", () => {
  it("accepts exact versions, prereleases, aliases, and commit-pinned GitHub specs", () => {
    const result = checkManifest({
      dependencies: { a: "1.2.3", b: "4.0.0-rc.1", c: "npm:real-name@2.0.0" },
      devDependencies: { d: "github:owner/repo#012daeb0d1809f0e026b9425dddc9a42a77c3328" },
    });
    assert.equal(result.status, 0, result.stderr);
  });

  for (const spec of ["^1.2.3", "~1.2.3", ">=1.0.0", "latest", "*", "github:owner/repo#main"]) {
    it(`rejects ${spec}`, () => {
      const result = checkManifest({ devDependencies: { loose: spec } });
      assert.equal(result.status, 1);
      assert.match(
        result.stderr,
        new RegExp(`devDependencies\\.loose: ${spec.replace(/[\^*]/g, "\\$&")}`),
      );
    });
  }
});
