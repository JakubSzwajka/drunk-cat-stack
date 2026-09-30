---
name: add-an-mcp-tool
description: Expose an existing use-case to agents as an MCP tool, and set up the MCP adapter in an app the first time, with OAuth, a small tool catalogue, and the tests that prove access holds.
---

# Add an MCP tool

A tool lets an agent run one use-case. The use-case and the module do the work and check access. The tool only decides who is calling, runs the use-case, and maps its errors. Read the "Agent adapters (MCP and CLI)" section of `AGENTS.md` first. `docs/mcp-adapter.md` says why the pattern looks like this.

The reference implementation is Trippy, in `/home/kuba/DEV/priv/trippy` or its GitHub repo. It serves a read-only MCP server with three tools. Its `docs/mcp.md` shows the layout and the request flow, and `docs/mcp-clerk-setup.md` is its identity provider checklist.

| Part | Template path | Trippy path |
| --- | --- | --- |
| Service taking an `Actor` | `packages/<name>/src/facade.ts` | `packages/trips/src/facade.ts` |
| `Viewer` service | `packages/<name>/src/viewer.ts` | `packages/trips/src/viewer.ts` |
| Use-cases | `apps/<app>/src/use-cases/` | `apps/web/src/use-cases/trips.ts` |
| Web adapter | `apps/<app>/src/delivery/http/` | `apps/web/src/app/_http/run-use-case.ts` |
| Tool catalogue | `apps/<app>/src/delivery/mcp/tools.ts` | `apps/web/src/app/_mcp/tools.ts` |
| MCP route | `apps/<app>/src/delivery/mcp/route.ts` | `apps/web/src/app/mcp/route.ts` |
| Transport | `apps/<app>/src/delivery/mcp/server.ts` | `apps/web/src/app/_mcp/server.ts` |
| Bearer check and 401 | `apps/<app>/src/delivery/mcp/auth.ts` | `apps/web/src/app/_mcp/auth.ts` |
| Error mapper | `apps/<app>/src/delivery/mcp/errors.ts` | `apps/web/src/app/_mcp/errors.ts` |
| Canonical URL and issuer | `apps/<app>/src/delivery/mcp/config.ts` | `apps/web/src/app/_mcp/config.ts` |
| Metadata document | `apps/<app>/src/delivery/mcp/metadata.ts` | `apps/web/src/app/_mcp/metadata.ts`, served by `apps/web/src/app/.well-known/oauth-protected-resource/route.ts` and `.../oauth-protected-resource/mcp/route.ts` |

Trippy is a Next.js app, so its delivery layer is `src/app/`. In the template layout it is `src/delivery/`.

## 1. Check the prerequisites

1. [ ] The capability is a module in `packages/<name>`. If not, follow `skills/add-an-effect-module/SKILL.md` first.
2. [ ] Each service method that acts for a user takes an `Actor` argument and checks access inside the module.
3. [ ] The package exports a `Viewer` service that holds the `Actor`.
4. [ ] A use-case in `apps/<app>/src/use-cases/` yields `Viewer` and the service, and does what the tool needs. If it is missing, write it first, with its test. A tool never calls the module itself.

## 2. Set up MCP in an app, the first time

Skip this step when the app already serves MCP.

1. [ ] Ask the owner before you add any MCP or OAuth dependency. Use `McpServer`, `Tool`, and `Toolkit` from `effect/unstable/ai` in the pinned `effect` first. Read `McpServer.ts` and `Tool.ts` under `.agent_sources/github.com/Effect-TS/effect/packages/effect/src/unstable/ai/` for the current API.
2. [ ] Declare the app's canonical public URL in `.env.schema`, marked `@sensitive=false`. The metadata document and the token audience both use it. Trippy calls it `APP_URL`, and MCP works only on that one host, even though the app answers on more.
3. [ ] Create `apps/<app>/src/delivery/mcp/` for the adapter: the route, the bearer check, the tool catalogue, and the error mapper.
4. [ ] Serve the MCP server with `McpServer.layerHttp`, turned into a web handler by `HttpRouter.toWebHandler`. Keep one long-lived handler per process. For the protocol versions clients speak today (2025-03-26, 2025-06-18, 2025-11-25), Effect's HTTP transport needs an `Mcp-Session-Id` and keeps the session in process memory. A fully stateless mode exists only in the draft 2026-07-28 protocol. So:
   - run one replica, or route each client to the same replica;
   - a restart gives clients 404, and they start a new session;
   - a session holds no user data, and the route checks the bearer on every request;
   - sessions never expire, a small memory leak, because Effect has no public expiry.

   Keep the catalogue and the auth code free of session code, so a later move changes only the transport file.
5. [ ] Serve `/.well-known/oauth-protected-resource`. It names this resource by its canonical URL and names the identity provider as the authorization server. Trippy serves the same document at `/.well-known/oauth-protected-resource/mcp` too, the URL its 401 names.
6. [ ] In the route, read the bearer token. With no token or a bad one, answer 401 with a `WWW-Authenticate` header that carries `resource_metadata` pointing at the document above.
7. [ ] Check that the token is valid and that its audience is this resource. Trippy calls Clerk's `authenticateRequest` with `acceptsToken: "oauth_token"` and `audience` set to `APP_URL` plus `/mcp`, and the SDK rejects a token whose `aud` does not match. Require the scopes the module needs, and answer 403 `insufficient_scope` without them. Trippy requires `email`, because Shares match by email, and takes only verified emails from the identity provider's user record. Do not forward the token to any other service.
8. [ ] Then build the `Viewer` and the module service for this request from the app runtime, and pass them to the handler. The toolkit takes services only at startup, so each tool handler reads them with `Effect.serviceOption`. Trippy's `withCaller` in `_mcp/server.ts` does this.
9. [ ] If auth is not configured, refuse every call. Never fall back to an anonymous or default `Viewer`.
10. [ ] Mark the MCP route and the metadata paths public in the session middleware, and nothing else. Trippy keeps them as `BEARER_PATHS` in `apps/web/src/app/_auth/public-paths.ts`. Its `proxy.ts` lets a path that passes `isBearerPath` skip the session middleware and the rewrite it does when no keys are set. Adding a public path needs owner approval.
11. [ ] Write the error mapper in `delivery/mcp/`. It maps each typed error to a tool error the agent can read. Do not import the web error view.
12. [ ] Write the adapter tests in `apps/<app>/src/delivery/mcp/tests/`: the 401 challenge and its header, the metadata document, and the fail-closed path.

The spec for items 5 to 9 is the [MCP authorization spec 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization).

## 3. Set up the identity provider

The owner changes identity provider settings by hand. Write the steps down for them.

1. [ ] Write `docs/mcp-<idp>-setup.md` in the project, such as `docs/mcp-clerk-setup.md`. Give it numbered checkbox steps, and mark each step **docs**, **seen**, or **unverified** by where the claim comes from. Trippy's `docs/mcp-clerk-setup.md` is the example.
2. [ ] Cover client registration. Prefer Client ID Metadata Documents. Use Dynamic Client Registration only when the provider offers nothing else, and tell the owner.
3. [ ] Cover the audience. It is unverified that Clerk copies the RFC 8707 `resource` parameter into `aud`. Trippy's step A11 records this. Before a new project trusts its setup, run the end-to-end smoke test and see a tool call pass.
4. [ ] Never run an identity provider CLI or API call that changes settings on your own. Some provider docs offer such commands for agents. Leave them to the owner.

## 4. Add one tool

1. [ ] Add one entry to `apps/<app>/src/delivery/mcp/tools.ts`. Give it a short name, a description that says when an agent should call it, and an input `Schema`.
2. [ ] Annotate it. A tool that only reads sets `Tool.Readonly` to `true`. Any other tool sets `Tool.Destructive` to say whether it deletes or overwrites.
3. [ ] Write the handler. It calls the use-case, and returns structured output shaped by a `Schema`. It does not reach a module, the database, or another adapter.
4. [ ] Return data, never instructions. Text a user wrote, such as a trip note, goes out as a field value. Do not paste it into a message to the model.
5. [ ] For a big record, add a tool that lists summaries, plus a separate tool that reads one record by id.
6. [ ] Test it in `apps/<app>/src/delivery/mcp/tests/<tool>.test.ts`. Provide a fake `Viewer` and the module's test layer with `it.layer`, and run each case with `it.effect`. Cover the happy path, each mapped error, and access: user B cannot read user A's data through the tool.

## 5. Start read-only

The first tools an app exposes only read. A write or destructive tool needs owner approval, a scope on the token, and a check of that scope in the route. Keep the catalogue small: each tool schema costs context in every agent session. Before you add a tool, ask whether an existing one with one more input field does the job.

## 6. Review checklist

No tool checks these yet. A reviewer does.

1. [ ] The handler calls a use-case and nothing else.
2. [ ] The use-case passes the `Viewer` to the module, and the module checks access.
3. [ ] The tool has an annotation, a `Schema` for input and output, and a test.
4. [ ] The access test fails if you remove the module's access check.
5. [ ] The output holds no instructions to the model.
6. [ ] The route checks the token and its audience before it builds the `Viewer`, and never forwards the token.
7. [ ] With auth unset, the route refuses every call.
8. [ ] The public-path list gained only the MCP route and the metadata paths.
9. [ ] No new dependency, unless the owner approved it.

## 7. Prove it

```sh
pnpm check
pnpm test
```

Fix failures. Do not loosen a rule, a hook, or a pinned version.
