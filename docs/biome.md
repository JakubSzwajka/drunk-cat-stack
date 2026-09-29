# Biome preset

Import path: `eslint-plugin-codebase-ai-rules/biome`

It is drunk-cat-stack's `biome.json` without the `files` block: formatter on (spaces, indent 2, line width 100), assist off, and the linter with `preset: "none"` plus four rules.

| Rule | Level |
| --- | --- |
| `performance/noReExportAll` | error |
| `style/noNonNullAssertion` | error |
| `style/useFilenamingConvention` (`kebab-case` or `export`) | error |
| `style/noExcessiveLinesPerFile` (300 lines, blank lines counted) | warn |

```json
// biome.json
{
  "$schema": "https://biomejs.dev/schemas/2.5.14/schema.json",
  "extends": ["eslint-plugin-codebase-ai-rules/biome"],
  "files": {
    "includes": ["**", "!!node_modules", "!!dist", "!!coverage", "!!generated", "!!.agent_sources"]
  }
}
```

Biome resolves the specifier through this package's `exports` map. The preset file is `biome/preset.json`, not `biome.json`, because Biome treats a nested file named `biome.json` as a second root config.

## Why `files` stays in the consumer

Biome does not merge `files.includes` from an extended config with the consumer's. When the consumer sets `files.includes`, the preset's list is dropped. A consumer that added one exclude would silently lose the rest. So the preset leaves `files` out, and each repository lists its own excludes. Globs in the consumer's list resolve against the consumer's root.

## Tested against

Biome 2.5.14. A test extends the preset from a symlinked install, checks a clean file passes, and checks that `export *`, a non-null assertion and a PascalCase file name each fail by rule name.
