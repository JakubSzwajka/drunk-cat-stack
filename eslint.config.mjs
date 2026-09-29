import houseRules from "@jakubszwajka/house-rules";
import houseRulesMarkdown from "@jakubszwajka/house-rules/markdown";

export default [
  { ignores: ["**/node_modules/", "**/dist/", "**/coverage/", "**/generated/", ".agent_sources/"] },
  ...houseRules.configs.recommended,
  ...houseRulesMarkdown,
];
