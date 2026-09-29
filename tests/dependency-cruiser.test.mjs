import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { cruise } from "dependency-cruiser";
import preset, { layout } from "../src/dependency-cruiser.cjs";

const require = createRequire(import.meta.url);
const FIXTURES = path.resolve(import.meta.dirname, "fixtures/dependency-cruiser");
const RULES = [
  "no-cycles",
  "packages-do-not-import-apps",
  "apps-do-not-import-other-apps",
  "packages-imported-by-name",
  "packages-public-entry-only",
  "delivery-does-not-import-server",
  "server-does-not-import-delivery",
  "use-cases-do-not-import-outer-layers",
  "no-unresolved-deep-package-imports",
  "production-does-not-import-tests",
  "tests-live-in-tests-dir",
  "tests-do-not-import-internals",
  "no-unresolved-imports",
];
// An unresolvable deep import is also an unresolved import; both rules are meant to fire.
const ALSO_FIRES = { "no-unresolved-deep-package-imports": ["no-unresolved-imports"] };

// Copies a fixture tree to a temporary workspace and links each package into node_modules, as pnpm does.
// A stub `test-runner` package stands in for a third-party import such as `@effect/vitest`.
async function violatedRules(fixture, config) {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "codebase-ai-rules-depcruise-"));
  try {
    await cp(path.join(FIXTURES, fixture), workspace, { recursive: true });
    await mkdir(path.join(workspace, "node_modules/test-runner"), { recursive: true });
    await writeFile(path.join(workspace, "node_modules/test-runner/package.json"), '{ "name": "test-runner", "main": "index.js" }\n');
    await writeFile(path.join(workspace, "node_modules/test-runner/index.js"), "exports.it = () => {};\n");
    const packagesDir = path.join(workspace, "packages");
    for (const name of existsSync(packagesDir) ? await readdir(packagesDir) : []) {
      const manifest = path.join(packagesDir, name, "package.json");
      if (!existsSync(manifest)) continue;
      const link = path.join(workspace, "node_modules", JSON.parse(await readFile(manifest, "utf8")).name);
      await mkdir(path.dirname(link), { recursive: true });
      await symlink(path.join(packagesDir, name), link, "dir");
    }
    const roots = ["apps", "packages"].filter((root) => existsSync(path.join(workspace, root)));
    const { forbidden, options } = config;
    const { output } = await cruise(roots, {
      ...structuredClone(options),
      baseDir: workspace,
      ruleSet: { forbidden: structuredClone(forbidden) },
      validate: true,
      outputType: "json",
    });
    const { summary } = JSON.parse(output);
    return summary.violations.map(({ rule, from, to }) => ({ rule: rule.name, from, to }));
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

const ruleNames = (violations) => [...new Set(violations.map(({ rule }) => rule))].sort();

test("layout() with drunk-cat-stack's scope reproduces its hand-written config exactly", () => {
  const original = require("./fixtures/dependency-cruiser/drunk-cat-stack.cjs");
  const config = layout({ scope: "@hosti/" });
  assert.deepEqual(config, original);
  assert.deepEqual(
    config.forbidden.map(({ name, severity }) => [name, severity]),
    RULES.map((name) => [name, "error"]),
  );
});

test("layout() is exported for require and import, returns a fresh config, and validates options", () => {
  assert.equal(preset.layout, layout);
  assert.equal(require("../src/dependency-cruiser.cjs").layout, layout);
  const first = layout({ scope: "@acme/" });
  first.forbidden.push({ name: "project-rule", from: {}, to: {} });
  assert.equal(layout({ scope: "@acme/" }).forbidden.length, RULES.length);
  assert.deepEqual(layout({ scope: "@acme" }).forbidden, layout({ scope: "@acme/" }).forbidden);

  const renamed = layout({
    scope: "@my.org/",
    appsDir: "services",
    packagesDir: "libs",
    layers: { useCases: "application" },
    publicEntry: "src/main.ts",
    internalDir: "lib/private",
    testsDir: "spec",
  });
  const byName = Object.fromEntries(renamed.forbidden.map((rule) => [rule.name, rule]));
  assert.equal(byName["use-cases-do-not-import-outer-layers"].from.path, "^services/[^/]+/src/application(?:/|$)");
  assert.equal(byName["delivery-does-not-import-server"].from.path, "^services/[^/]+/src/delivery(?:/|$)");
  assert.equal(byName["packages-public-entry-only"].to.path, "^libs/[^/]+/(?!src/main[.]ts$)");
  assert.equal(byName["no-unresolved-deep-package-imports"].to.path, "^@my[.]org/[^/]+/.+");
  assert.equal(byName["tests-do-not-import-internals"].to.path, "^libs/[^/]+/lib/private(?:/|$)");
  assert.equal(
    byName["tests-live-in-tests-dir"].module.pathNot,
    "^(?:services|libs)/[^/]+/src/(?:spec|.*/spec)/[^/]+[.](?:test|spec)[.][^/]+$",
  );
  assert.equal(byName["production-does-not-import-tests"].to.path, "(?:^|/)(?:tests?|__tests__|spec)(?:/|$)|[.](?:test|spec)[.][^/]+$");

  assert.throws(() => layout(), /scope is required/);
  assert.throws(() => layout({ scope: "" }), /scope is required/);
  assert.throws(() => layout({ scope: "@acme/", layer: {} }), /unknown option "layer"/);
  assert.throws(() => layout({ scope: "@acme/", layers: { domain: "domain" } }), /unknown layer "domain"/);
  assert.throws(() => layout({ scope: "@acme/", appsDir: "apps/" }), /appsDir must be a non-empty relative path/);
  assert.throws(() => layout({ scope: "@acme/", layers: { server: "" } }), /layers.server must be/);
});

test("the preset loads no other module", () => {
  const loaded = execFileSync(
    process.execPath,
    ["-e", 'require("./src/dependency-cruiser.cjs"); console.log(JSON.stringify(Object.keys(require.cache)));'],
    { cwd: path.resolve(import.meta.dirname, ".."), encoding: "utf8" },
  );
  assert.deepEqual(JSON.parse(loaded), [path.resolve(import.meta.dirname, "../src/dependency-cruiser.cjs")]);
});

test("a clean workspace has no violations", async () => {
  assert.deepEqual(await violatedRules("clean", layout({ scope: "@acme/" })), []);
});

test("tests-live-in-tests-dir reports every misplaced test, including ones with no workspace imports", async () => {
  const violations = await violatedRules("violations/tests-live-in-tests-dir", layout({ scope: "@acme/" }));
  assert.deepEqual(violations.map(({ rule, from }) => `${rule}: ${from}`).sort(), [
    "tests-live-in-tests-dir: apps/web/src/delivery/route.test.ts",
    "tests-live-in-tests-dir: packages/a/src/beside.test.ts",
    "tests-live-in-tests-dir: packages/a/src/tests/unit/nested.test.ts",
    "tests-live-in-tests-dir: packages/a/src/unit-tests/suffix.spec.ts",
    "tests-live-in-tests-dir: packages/a/tests/package-root.test.ts",
  ]);
});

for (const name of RULES) {
  test(`${name} fires on its fixture`, async () => {
    const violations = await violatedRules(`violations/${name}`, layout({ scope: "@acme/" }));
    assert.deepEqual(ruleNames(violations), [name, ...(ALSO_FIRES[name] ?? [])].sort(), JSON.stringify(violations));
  });
}

test("the violation fixtures cover every rule and nothing else", async () => {
  assert.deepEqual((await readdir(path.join(FIXTURES, "violations"))).sort(), [...RULES].sort());
});

test("renaming layers.useCases moves the use-cases rule to the new folder", async () => {
  assert.deepEqual(await violatedRules("renamed-layers", layout({ scope: "@acme/" })), []);
  assert.deepEqual(await violatedRules("renamed-layers", layout({ scope: "@acme/", layers: { useCases: "application" } })), [
    {
      rule: "use-cases-do-not-import-outer-layers",
      from: "apps/web/src/application/show.ts",
      to: "apps/web/src/delivery/route.ts",
    },
  ]);
});
