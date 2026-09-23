import { readFileSync } from "node:fs";

const DEPENDENCY_FIELDS = ["dependencies", "devDependencies", "optionalDependencies"];
const EXACT_VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u;
const COMMIT_PINNED_GIT = /^(?:github:|git\+https:\/\/|git\+ssh:\/\/)[^#]+#[0-9a-f]{40}$/u;

const isExact = (spec) => {
  const target = spec.startsWith("npm:") ? spec.slice(spec.lastIndexOf("@") + 1) : spec;
  return EXACT_VERSION.test(target) || COMMIT_PINNED_GIT.test(spec);
};

const manifestPath = process.argv[2] ?? "package.json";
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

const loose = DEPENDENCY_FIELDS.flatMap((field) =>
  Object.entries(manifest[field] ?? {})
    .filter(([, spec]) => !isExact(spec))
    .map(([name, spec]) => `${field}.${name}: ${spec}`),
);

if (loose.length > 0) {
  console.error(`Dependencies in ${manifestPath} must be exact versions or full commit SHAs:`);
  for (const line of loose) {
    console.error(`  ${line}`);
  }
  process.exit(1);
}
console.log(`pins: every dependency in ${manifestPath} is exact`);
