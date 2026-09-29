# Exact-pins checker

Bin: `codebase-ai-rules-pins` (`bin/pins.mjs`)

Moved from drunk-cat-stack's `scripts/check-exact-pins.mjs` with the same behavior, messages and exit codes. Its tests moved too, to `tests/pins.test.mjs`.

```json
// package.json
{
  "scripts": {
    "pins": "codebase-ai-rules-pins"
  }
}
```

## What passes

Every entry in `dependencies`, `devDependencies` and `optionalDependencies` must be one of:

- an exact version, prerelease or build included: `1.2.3`, `4.0.0-rc.1`
- an npm alias to an exact version: `npm:real-name@2.0.0`
- `workspace:` plus an exact version: `workspace:0.0.0`
- a Git spec pinned to a full 40-character commit: `github:owner/repo#<sha>`, `git+https://...#<sha>`, `git+ssh://...#<sha>`

`packageManager`, when set, must end in an exact version.

## Which manifests

- With arguments, it checks exactly those `package.json` paths.
- Without arguments, it reads the `packages:` list from `pnpm-workspace.yaml` in the working directory, and checks the root `package.json` plus every matching `<pattern>/package.json`. No `packages:` list is an error.

## Output and exit codes

- `0`: prints `pins: every dependency is exact in <paths>`.
- `1`: prints `Dependencies in <path> must be exact versions or full commit SHAs:` and one `  <field>.<name>: <spec>` line per loose entry, to stderr.

## Node versions

Workspace mode uses `fs.globSync`, which Node 22 added. On Node 20 the bin still checks paths passed as arguments. Without arguments it exits 1 with `pins: reading pnpm-workspace.yaml needs Node 22 or newer; pass manifest paths instead`. The workspace tests skip on Node 20.
