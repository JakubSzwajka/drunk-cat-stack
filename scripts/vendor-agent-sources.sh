#!/usr/bin/env bash
# Shallow-clone reference source for agents into .agent_sources/github.com/<owner>/<repo>.
# Reference only, never a runtime dependency. Not part of `npm run check`.
# Usage: npm run vendor:agent-sources [-- --refresh]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PREFIX="${ROOT}/.agent_sources/github.com"
REFRESH=false

for arg in "$@"; do
  case "$arg" in
    --refresh) REFRESH=true ;;
    -h | --help)
      echo "Usage: $0 [--refresh]"
      exit 0
      ;;
    *)
      echo "Unknown arg: $arg" >&2
      exit 1
      ;;
  esac
done

clone_source() {
  local owner="$1" repo="$2" remote="$3" ref="$4"
  local dest="${PREFIX}/${owner}/${repo}"

  if [[ -d "${dest}/.git" && "$REFRESH" != true ]]; then
    echo "skip ${owner}/${repo} (exists; pass --refresh to replace)"
    return 0
  fi
  rm -rf "$dest"
  mkdir -p "$(dirname "$dest")"
  echo "clone ${owner}/${repo} @ ${ref}"
  git -c advice.detachedHead=false clone --quiet --depth 1 --branch "$ref" "$remote" "$dest"

  cat >"${dest}/.agent-source.json" <<EOF
{
  "remote": "${remote}",
  "ref": "${ref}",
  "commit": "$(git -C "$dest" rev-parse HEAD)",
  "addedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF
  echo "  -> ${dest}"
}

# The ref follows the pin in package.json, so bumping effect there bumps the mirror.
EFFECT_VERSION="$(node -p "require('${ROOT}/package.json').dependencies.effect")"

clone_source Effect-TS effect https://github.com/Effect-TS/effect.git "effect@${EFFECT_VERSION}"

echo "done: agent sources under ${PREFIX}"
