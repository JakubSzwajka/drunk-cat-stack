"use strict";

const DEFAULTS = {
  appsDir: "apps",
  packagesDir: "packages",
  publicEntry: "src/index.ts",
  internalDir: "src/internal",
  testsDir: "tests",
};
const DEFAULT_LAYERS = { delivery: "delivery", server: "server", useCases: "use-cases" };
const OPTION_NAMES = new Set(["scope", "layers", ...Object.keys(DEFAULTS)]);
const BUILT_IN_TEST_DIRS = new Set(["test", "tests", "__tests__"]);

const EXCLUDED_PATH = "(?:^|/)(?:node_modules|dist|coverage|generated|[.]turbo|[.]agent_sources)(?:/|$)";

// Dots become `[.]` so the default patterns stay byte-equal to drunk-cat-stack's hand-written ones.
function escape(value) {
  return value.replace(/[\\^$*+?()[\]{}|]/g, "\\$&").replace(/[.]/g, "[.]");
}

function pathOption(value, label) {
  if (typeof value !== "string" || !value || value.startsWith("/") || value.endsWith("/")) {
    throw new TypeError(`layout(): ${label} must be a non-empty relative path without a leading or trailing "/".`);
  }
  return escape(value);
}

function scopeOption(scope) {
  if (typeof scope !== "string" || !scope || scope === "/") {
    throw new TypeError('layout(): scope is required, for example "@acme/".');
  }
  return escape(scope.endsWith("/") ? scope : `${scope}/`);
}

function layerOptions(layers) {
  if (layers === null || typeof layers !== "object" || Array.isArray(layers)) {
    throw new TypeError("layout(): layers must be an object.");
  }
  for (const name of Object.keys(layers)) {
    if (!(name in DEFAULT_LAYERS)) {
      throw new TypeError(`layout(): unknown layer "${name}". Known layers: ${Object.keys(DEFAULT_LAYERS).join(", ")}.`);
    }
  }
  const merged = { ...DEFAULT_LAYERS, ...layers };
  return Object.fromEntries(Object.entries(merged).map(([name, value]) => [name, pathOption(value, `layers.${name}`)]));
}

function patterns(options) {
  const unknown = Object.keys(options).filter((name) => !OPTION_NAMES.has(name));
  if (unknown.length) {
    throw new TypeError(`layout(): unknown option "${unknown[0]}". Known options: ${[...OPTION_NAMES].join(", ")}.`);
  }
  const settings = { ...DEFAULTS, ...options };
  const apps = pathOption(settings.appsDir, "appsDir");
  const packages = pathOption(settings.packagesDir, "packagesDir");
  const tests = pathOption(settings.testsDir, "testsDir");
  const layers = layerOptions(settings.layers ?? {});
  const layerRoot = (layer) => `^${apps}/[^/]+/src/${layer}(?:/|$)`;
  const testDirs = BUILT_IN_TEST_DIRS.has(settings.testsDir) ? "tests?|__tests__" : `tests?|__tests__|${tests}`;
  const testFile = "[.](?:test|spec)[.][^/]+$";

  return {
    appsRoot: `^${apps}/`,
    packagesRoot: `^${packages}/`,
    workspaceRoot: `^((?:${apps}|${packages})/[^/]+)/`,
    appRoot: `^(${apps}/[^/]+)/`,
    sourceRoot: `^(?:${apps}|${packages})/[^/]+/src(?:/|$)`,
    publicEntry: `${pathOption(settings.publicEntry, "publicEntry")}$`,
    internalRoot: `^${packages}/[^/]+/${pathOption(settings.internalDir, "internalDir")}(?:/|$)`,
    deliveryRoot: layerRoot(layers.delivery),
    serverRoot: layerRoot(layers.server),
    useCasesRoot: layerRoot(layers.useCases),
    testPath: `(?:^|/)(?:${testDirs})(?:/|$)|${testFile}`,
    testFile: `^(?:${apps}|${packages})/[^/]+/.*${testFile}`,
    testFileInTestsDir: `^(?:${apps}|${packages})/[^/]+/src/(?:${tests}|.*/${tests})/[^/]+${testFile}`,
    packageNamespace: `^${scopeOption(settings.scope)}`,
  };
}

function rule(name, from, to) {
  return { name, severity: "error", from, to };
}

// Returns a whole dependency-cruiser configuration. Append project rules to the returned `forbidden` array.
function layout(options = {}) {
  if (options === null || typeof options !== "object" || Array.isArray(options)) {
    throw new TypeError("layout(): options must be an object.");
  }
  const p = patterns(options);
  return {
    forbidden: [
      rule("no-cycles", {}, { circular: true }),
      rule("packages-do-not-import-apps", { path: p.packagesRoot }, { path: p.appsRoot }),
      rule("apps-do-not-import-other-apps", { path: p.appRoot }, { path: p.appsRoot, pathNot: "^$1/" }),
      rule(
        "packages-imported-by-name",
        { path: p.workspaceRoot },
        { path: p.packagesRoot, pathNot: "^$1/", dependencyTypes: ["local"] },
      ),
      rule(
        "packages-public-entry-only",
        { path: p.workspaceRoot },
        { path: `${p.packagesRoot}[^/]+/(?!${p.publicEntry})`, pathNot: "^$1/" },
      ),
      rule("delivery-does-not-import-server", { path: p.deliveryRoot }, { path: p.serverRoot }),
      rule("server-does-not-import-delivery", { path: p.serverRoot }, { path: p.deliveryRoot }),
      rule("use-cases-do-not-import-outer-layers", { path: p.useCasesRoot }, { path: [p.deliveryRoot, p.serverRoot] }),
      rule("no-unresolved-deep-package-imports", {}, { path: `${p.packageNamespace}[^/]+/.+`, couldNotResolve: true }),
      rule("production-does-not-import-tests", { path: p.sourceRoot, pathNot: p.testPath }, { path: p.testPath }),
      // A module rule, because a test that imports nothing or only node_modules has no edge to report.
      {
        name: "tests-live-in-tests-dir",
        severity: "error",
        module: { path: p.testFile, pathNot: p.testFileInTestsDir, numberOfDependentsLessThan: 100 },
        from: {},
      },
      rule("tests-do-not-import-internals", { path: p.testPath }, { path: p.internalRoot }),
      rule("no-unresolved-imports", {}, { couldNotResolve: true }),
    ],
    options: {
      parser: "swc",
      exclude: { path: EXCLUDED_PATH },
      doNotFollow: { path: "(?:^|/)node_modules(?:/|$)" },
      skipAnalysisNotInRules: true,
      tsPreCompilationDeps: "specify",
      enhancedResolveOptions: {
        exportsFields: ["exports"],
        conditionNames: ["import", "require", "node", "default"],
      },
    },
  };
}

module.exports = { layout };
