# Clerk as the MCP authorization server

Use this when an app made from the stack signs agents in with Clerk. The owner changes every Clerk setting by hand, in the dashboard. An agent never runs a Clerk CLI or API call that changes settings. Clerk's docs carry "for AI agents" snippets that do. Ignore them.

These facts were checked on a real Clerk development instance on 30 Sep 2026. Trippy's `docs/mcp-clerk-setup.md` is the fuller example, with a source for each step.

## 1. Dashboard

Open Configure, then Developers, then OAuth applications. The page has three tabs: Applications, Scopes, and Settings. Everything below happens on the Settings tab. You do not create an OAuth application for a CIMD client. You do not need the Scopes tab while the server asks only for the built-in `email` scope.

1. [ ] Client onboarding: turn on "Publish CIMD support".
2. [ ] Client admission: pick "Any compatible CIMD client" while you test. Tighten it once your clients have connected.
3. [ ] Leave "Publish DCR support" off. The dashboard marks it Deprecated. It opens a public registration endpoint, so turn it on only if a client needs it.
4. [ ] "Default scopes for dynamic clients" shows `email`, `profile`, and `offline_access`. Those are Clerk's defaults and include `email`. Change nothing.
5. [ ] Authorization security: turn on "Require PKCE".
6. [ ] Access tokens: keep JWT access tokens.
7. [ ] Access tokens: turn on "Include audience". It is off by default.

The dashboard says of "Include audience": "OAuth access tokens will include an optional "aud" claim. This will be populated based on a client's requested "resource", if requested." The server wants `aud` to hold its resource URL, `<APP_URL>/mcp` in Trippy. With the setting off, tokens carry no `aud`, and the audience check rejects every call with 401 `invalid_token`. It fills `aud` only when the client sends the RFC 8707 `resource` parameter. A token issued before you turned it on has no `aud`, so sign in again.

## 2. App

1. [ ] Set the canonical public URL variable in `.env.local` and in production. Trippy calls it `APP_URL`.
2. [ ] The app reads the Clerk issuer from the publishable key. It needs no variable of its own.
3. [ ] Compare the issuers. They must match exactly, character for character:

   ```sh
   curl -s "$APP_URL/.well-known/oauth-protected-resource"
   curl -s "https://<frontend api host>/.well-known/oauth-authorization-server"
   ```

   The first answer's `authorization_servers[0]` must equal the second answer's `issuer`.

## 3. Read the settings back

This call only reads. Pass the secret key as the bearer, and never print it. Varlock injects it from `.env.local`:

```sh
pnpm exec varlock run -- sh -c 'curl -s https://api.clerk.com/v1/instance/oauth_application_settings \
  -H "Authorization: Bearer $CLERK_SECRET_KEY"'
```

1. [ ] `aud_claim_enabled` is `true`.
2. [ ] `client_id_metadata_documents_advertised` is `true`.
3. [ ] `pkce_required` is `true`.
4. [ ] `oauth_jwt_access_tokens` is `true`.

## 4. Clients

1. [ ] Claude Code works end to end with CIMD, including its random loopback port. Run `claude mcp add --transport http <name> <url>`, then `/mcp` inside Claude Code to sign in.
2. [ ] Pi's MCP adapter did not get an `aud`. The cause is not confirmed. It supports only a pre-registered client id or DCR. Pi is expected to ship proper MCP support soon.
3. [ ] MCP Inspector and ChatGPT are not tested yet.
4. [ ] Sign in as a second user and check that the tools do not show the first user's data.
