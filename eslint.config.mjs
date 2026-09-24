import codebaseAiRules from "eslint-plugin-codebase-ai-rules";
import codebaseAiMarkdown from "eslint-plugin-codebase-ai-rules/markdown";

export default [
  { ignores: ["**/node_modules/", "**/dist/", "**/coverage/", "**/generated/", ".agent_sources/"] },
  ...codebaseAiRules.configs.recommended,
  ...codebaseAiMarkdown,
];
