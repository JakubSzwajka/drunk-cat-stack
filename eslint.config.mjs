import codebaseAiRules from "eslint-plugin-codebase-ai-rules";

export default [
  { ignores: ["**/node_modules/", "**/dist/", "**/coverage/", "**/generated/", ".agent_sources/"] },
  ...codebaseAiRules.configs.recommended,
];
