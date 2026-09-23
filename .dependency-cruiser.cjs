const APPS_ROOT = "^apps/";
const PACKAGES_ROOT = "^packages/";
const WORKSPACE_ROOT = "^((?:apps|packages)/[^/]+)/";
const APP_ROOT = "^(apps/[^/]+)/";
const SOURCE_ROOT = "^(?:apps|packages)/[^/]+/src(?:/|$)";
const PUBLIC_ENTRY = "src/index[.]ts$";
const DELIVERY_ROOT = "^apps/[^/]+/src/delivery(?:/|$)";
const SERVER_ROOT = "^apps/[^/]+/src/server(?:/|$)";
const USE_CASES_ROOT = "^apps/[^/]+/src/use-cases(?:/|$)";
const TEST_PATH = "(?:^|/)(?:tests?|__tests__)(?:/|$)|[.](?:test|spec)[.][^/]+$";
const PACKAGE_NAMESPACE = "^@hosti/";

const EXCLUDED_PATH =
  "(?:^|/)(?:node_modules|dist|coverage|generated|[.]turbo|[.]agent_sources)(?:/|$)";

module.exports = {
  forbidden: [
    {
      name: "no-cycles",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "packages-do-not-import-apps",
      severity: "error",
      from: { path: PACKAGES_ROOT },
      to: { path: APPS_ROOT },
    },
    {
      name: "apps-do-not-import-other-apps",
      severity: "error",
      from: { path: APP_ROOT },
      to: { path: APPS_ROOT, pathNot: "^$1/" },
    },
    {
      name: "packages-imported-by-name",
      severity: "error",
      from: { path: WORKSPACE_ROOT },
      to: { path: PACKAGES_ROOT, pathNot: "^$1/", dependencyTypes: ["local"] },
    },
    {
      name: "packages-public-entry-only",
      severity: "error",
      from: { path: WORKSPACE_ROOT },
      to: { path: `${PACKAGES_ROOT}[^/]+/(?!${PUBLIC_ENTRY})`, pathNot: "^$1/" },
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
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
    },
  },
};
