import codebaseAiRules from "eslint-plugin-codebase-ai-rules";

export default [
  { ignores: ["**/node_modules/", "**/dist/", "**/coverage/", "**/generated/"] },
  ...codebaseAiRules.configs.recommended,
];
