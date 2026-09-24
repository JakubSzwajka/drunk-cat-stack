import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { ESLint } from "eslint";
import codebaseAiMarkdown from "eslint-plugin-codebase-ai-rules/markdown";

const lintMarkdown = async (source) => {
  const dir = mkdtempSync(join(tmpdir(), "no-broken-relative-links-"));
  try {
    execFileSync("git", ["init", "--quiet"], { cwd: dir });
    writeFileSync(join(dir, "target.md"), "# Target\n");
    execFileSync("git", ["add", "target.md"], { cwd: dir });
    writeFileSync(join(dir, "source.md"), source);
    const eslint = new ESLint({
      cwd: dir,
      overrideConfigFile: true,
      overrideConfig: codebaseAiMarkdown,
    });
    const [result] = await eslint.lintFiles(["source.md"]);
    return result.messages;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

describe("codebase-ai-rules/no-broken-relative-links via the markdown preset", () => {
  it("reports a relative link to an untracked path", async () => {
    const messages = await lintMarkdown("[broken](./missing.md)\n");
    assert.equal(messages.length, 1);
    assert.equal(messages[0].ruleId, "codebase-ai-rules/no-broken-relative-links");
    assert.match(messages[0].message, /Broken relative link "\.\/missing\.md"/);
  });

  it("passes a relative link to a git-tracked path", async () => {
    const messages = await lintMarkdown("[fine](./target.md)\n");
    assert.deepEqual(messages, []);
  });
});
