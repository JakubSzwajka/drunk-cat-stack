# eslint-plugin-codebase-ai-rules

This repository contains a private GitHub package with six ESLint rules and one Dependency Cruiser preset. It extracts Hosti's comment-discipline rule without changing the rule's semantics, adds a Markdown rule that reports relative links to paths git does not track, adds four design-token rules for CSS and JS/TS, and ships drunk-cat-stack's monorepo layout rules as a reusable Dependency Cruiser config.

## Vocabulary

- **Rule**: one of the six lint rules in this package: `comment-discipline`, `no-broken-relative-links`, `design-no-raw-color`, `design-no-raw-color-literal`, `design-no-unknown-token`, or `design-scale-value`.
- **Preset**: a flat-config array a consumer spreads into `eslint.config.mjs`. There are three:
  - `recommended`, exported as `plugin.configs.recommended` from the package root. It runs `comment-discipline` on JS, JSX, MJS, CJS, TS, TSX, MTS, and CTS.
  - `markdown`, the default export of the `eslint-plugin-codebase-ai-rules/markdown` subpath. It runs `no-broken-relative-links` on `**/*.md` through the `@eslint/markdown` GFM language.
  - `design`, the preset returned by the `design(options)` factory, the default and named export of the `eslint-plugin-codebase-ai-rules/design` subpath. It returns a CSS block on the `@eslint/css` `css/css` language running the three CSS design rules, and a source block running `design-no-raw-color-literal` with the same parser setup as `recommended`.
- **Layout preset**: the Dependency Cruiser config returned by the `layout(options)` factory, the named export of the `eslint-plugin-codebase-ai-rules/dependency-cruiser` subpath. It is not an ESLint preset and not one of the three presets above. It returns a whole Dependency Cruiser config, `forbidden` plus `options`, holding 13 **layout rules**. Layout rules are Dependency Cruiser rules, not ESLint rules, and are not counted among the six.
- **Consumer**: a repository that installs this package from GitHub and spreads one or more presets in `eslint.config.mjs`.
- **Exception**: one closed, syntax-owned directive or legal header accepted by `comment-discipline`.
- **Relative link**: a Markdown link, image, or link reference definition whose target has no URI scheme, is not a pure anchor, is not protocol-relative, and contains no `{` placeholder.
- **Tracked path**: a file listed by `git ls-files` for the repository that holds the linted file, or a parent directory of one. Matching is exact and case-sensitive.
- **Root**: a subdirectory named in the `roots` option. Links from files under a root resolve `/` against it and may not leave it.
- **Token file**: a CSS file named in `tokenFiles`, resolved from ESLint's working directory. Every custom property it defines is a **token**. Custom-property definitions inside a token file are exempt from `design-no-raw-color`.
- **Raw colour**: a hex colour, a colour function (`rgb()` through `color()`), or a named colour written out instead of taken from a token. The JS/TS rule checks hex and colour functions only.
- **Scale**: the `allowed` values and `requireVar` prefix of one `design-scale-value` entry.

## Contract

- Package name and version stay `eslint-plugin-codebase-ai-rules@0.3.0` until an intentional release decision changes them. `package.json` and `plugin.meta.version` carry the same version.
- The package is ESM, runs checked-in `.mjs` source directly (plus the one `.cjs` layout preset), and supports Node `^20.19.0 || ^22.13.0 || >=24.0.0`, matching the checked-in ESLint 10 toolchain.
- `private: true` stays set. Do not npm-publish.
- The plugin key is `codebase-ai-rules`.
- `@typescript-eslint/parser` is a runtime dependency so consumers install no parser separately.
- ESLint is a peer dependency and a development dependency for this repository.
- `@eslint/markdown` is an optional peer dependency and a development dependency. Only `src/markdown.mjs` imports it. The package root must never load it, so `recommended` consumers install nothing new.
- `@eslint/css` is an optional peer dependency and a development dependency. Only `src/design.mjs` imports it. The package root registers the design rules but must never load it. Token files are read by a small custom-property scanner in `src/design-tokens.mjs`, not by the CSS parser, for that reason.
- `dependency-cruiser` is an optional peer dependency and an exact development dependency. Only the tests import it. `src/dependency-cruiser.cjs` is the one CommonJS file in `src/`, so a `.dependency-cruiser.cjs` config can `require` it. It requires nothing, so it never loads ESLint, `@eslint/css`, or `@eslint/markdown`.
- `layout({ scope: "@hosti/" })` equals drunk-cat-stack's `.dependency-cruiser.cjs` exactly. `tests/fixtures/dependency-cruiser/drunk-cat-stack.cjs` is a copy of that file, and a test compares them. When drunk-cat-stack changes its rules, refresh the copy and the preset together.
- Token files are parsed once per process and cached by absolute real path, modification time, and size.
- Consumer path ignores do not belong in the preset.
- The `comment-discipline` source and tests are ported from Hosti. Packaging and config are generalized; its semantics are not changed.
- The `no-broken-relative-links` resolution logic and tests are ported from `pubnub/blocksnetwork` `scripts/check-md-links.mjs`. `@eslint/markdown` does the parsing. The hard-coded published subtree became the `roots` option.
- The `recommended` preset does not change when Markdown or design support changes.
- The design rules were specified from a read-only probe of Hosti's styles. `tests/fixtures/hosti/` keeps a trimmed copy of real Hosti cases as the parity fixture. The code is written fresh; nothing is copied from `pubnub/blocksnetwork`.

## Layout

```text
src/      checked-in plugin source
 tests/   unit and exported-preset tests
docs/     focused rule documentation
```

Keep source modules small. Tests should import the package entry point or exercise the exported presets. The pure link-resolution helpers in `src/relative-links.mjs` and `src/repository-paths.mjs`, and the design helpers in `src/colors.mjs`, `src/css-values.mjs`, `src/design-tokens.mjs` and `src/file-globs.mjs`, may also be unit tested directly. Do not add a build step.

## Verification

Run `npm run check` and `npm run pack:check`. For release or dependency changes, install the package from a fresh fixture using a pinned Git spec and run ESLint against JavaScript, TypeScript, Markdown, and CSS design pass/fail fixtures. The Markdown fixture must be a git repository with its files added to the index.
