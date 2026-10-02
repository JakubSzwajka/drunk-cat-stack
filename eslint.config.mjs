import houseRules from "@jakubszwajka/house-rules";
import houseRulesMarkdown from "@jakubszwajka/house-rules/markdown";

export default [
  { ignores: ["**/node_modules/", "**/dist/", "**/coverage/", "**/generated/", ".agent_sources/"] },
  ...houseRules.configs.recommended,
  ...houseRulesMarkdown,
  {
    files: ["packages/rules/**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"],
    rules: { "house-rules/comment-discipline": "off" },
  },
];
