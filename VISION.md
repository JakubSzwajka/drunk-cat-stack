# Vision

drunk-cat-stack is how I start a TypeScript project. Every repo made from it gets the same checks, the same pins, and the same hooks, so I stop setting them up by hand and stop finding each repo configured a little differently.

Agents take the shortest path. If a rule lives only in prose, an agent will skip it the first time the rule gets in its way. So the rules that a tool can check live in `npm run check`, lefthook runs that check before every commit, and the agent harnesses block `--no-verify`. The fence does not make an agent good. It raises the floor: the worst normal run still passes the checks.

Prose covers the rest. `AGENTS.md` holds the law. `README.md` lists what the tools check and what still needs a reviewer.

Each project made from this template writes its own `VISION.md`. This file describes the template, not your product.
