const SOURCE_ROOT = "^examples/hosti-after/src(?:/|$)";
const DELIVERY_ROOT = "^examples/hosti-after/src/delivery(?:/|$)";
const SERVER_ROOT = "^examples/hosti-after/src/server(?:/|$)";
const USE_CASES_ROOT = "^examples/hosti-after/src/use-cases(?:/|$)";
const MODULES_ROOT = "^examples/hosti-after/src/modules(?:/|$)";
const BOOKINGS_MODULE_ROOT = "^examples/hosti-after/src/modules/bookings(?:/|$)";
const TEST_PATH = "(?:^|/)(?:tests|__tests__)(?:/|$)|[.](?:test|spec)[.][^/]+$";
const PACKAGE_NAMESPACE = "^@hosti/";
const TSCONFIG = "tsconfig.json";

const EXCLUDED_PATH = "(?:^|/)(?:node_modules|dist|coverage|generated|[.]agent_sources)(?:/|$)";

module.exports = {
  forbidden: [
    {
      name: "no-cycles",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "delivery-does-not-import-server",
      severity: "error",
      from: { path: DELIVERY_ROOT },
      to: { path: SERVER_ROOT },
    },
    {
      name: "server-does-not-import-delivery",
      severity: "error",
      from: { path: SERVER_ROOT },
      to: { path: DELIVERY_ROOT },
    },
    {
      name: "use-cases-do-not-import-outer-layers",
      severity: "error",
      from: { path: USE_CASES_ROOT },
      to: { path: [DELIVERY_ROOT, SERVER_ROOT] },
    },
    {
      name: "modules-do-not-import-outer-layers",
      severity: "error",
      from: { path: MODULES_ROOT },
      to: { path: [USE_CASES_ROOT, DELIVERY_ROOT, SERVER_ROOT] },
    },
    {
      name: "bookings-public-entry-only",
      severity: "error",
      from: { path: SOURCE_ROOT, pathNot: BOOKINGS_MODULE_ROOT },
      to: {
        path: `${BOOKINGS_MODULE_ROOT}(?!index[.]ts$)`,
      },
    },
    {
      name: "no-unresolved-deep-package-imports",
      severity: "error",
      from: {},
      to: {
        path: `${PACKAGE_NAMESPACE}[^/]+/.+`,
        couldNotResolve: true,
      },
    },
    {
      name: "production-does-not-import-tests",
      severity: "error",
      from: { path: SOURCE_ROOT, pathNot: TEST_PATH },
      to: { path: TEST_PATH },
    },
    {
      name: "no-unresolved-imports",
      severity: "error",
      from: {},
      to: { couldNotResolve: true },
    },
  ],
  options: {
    parser: "swc",
    exclude: {
      path: EXCLUDED_PATH,
    },
    doNotFollow: {
      path: "(?:^|/)node_modules(?:/|$)",
    },
    skipAnalysisNotInRules: true,
    tsPreCompilationDeps: "specify",
    tsConfig: {
      fileName: TSCONFIG,
    },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
    },
  },
};
