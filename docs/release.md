# Release

This repo carries the reference copy of the release workflow. It is one file, `.github/workflows/release-create.yml`, named **Create release**. It holds every step in plain `run:` blocks, with no helper scripts. A merge to `main` ships nothing. A person runs **Create release** on `main`, and that run is the approval.

The template has no Dockerfile and no health endpoint, so the workflow never runs here. It starts only by hand (`workflow_dispatch`), never on push or pull request. `ci.yml` is separate.

## The flow

```text
Create release (dispatch on main)
  │
  ├─ build-and-tag            skipped when redeploy is set
  │    next vX.Y.Z from the newest v*.*.* tag (cli-v* tags are ignored)
  │    dry_run? ── yes ──> print version + commit subjects, stop
  │    build + push ONE image:
  │      ghcr.io/<owner>/<repo>:prod-sha-<12>   (immutable, what deploy uses)
  │      ghcr.io/<owner>/<repo>:vX.Y.Z
  │      ghcr.io/<owner>/<repo>:latest
  │    git tag vX.Y.Z + push, gh release create --generate-notes
  │
  └─ deploy                   after a good build, or alone with redeploy
       vX.Y.Z ─> commit ─> prod-sha-<12>
       Dokploy application.update (image) ─> application.deploy
         title "vX.Y.Z (prod-sha-<12>)"
       poll APP_URL/api/health until 200 and commit == <12>  (10 min)
       notify Discord (always, never fails the job)
```

The build runs before the tag, so a failed build never leaves a tag or a release behind. The image name is the repository name in lowercase, because GHCR rejects uppercase.

Runs share one concurrency group per repo, `<repo>-release`. A second run waits and is never cancelled.

## What a project needs

1. [ ] A `Dockerfile` that bakes in the commit:

   ```dockerfile
   ARG APP_COMMIT=unknown
   ENV APP_COMMIT=$APP_COMMIT
   ```

2. [ ] A health endpoint at `/api/health`. It returns HTTP 200 with this body, where `commit` is the first 12 characters of `APP_COMMIT`:

   ```json
   {"status":"ok","commit":"0123456789ab"}
   ```

   The old container keeps answering 200 until the new one is healthy. That is why the deploy waits for the new `commit`, not for any 200.

3. [ ] Repo secrets: `DOKPLOY_API_KEY` and `DISCORD_DEPLOY_WEBHOOK`. The webhook is a plain Discord channel webhook URL. If it is empty, the notify step does nothing.
4. [ ] Repo variables: `DOKPLOY_BASE_URL`, `DOKPLOY_APPLICATION_ID`, and `APP_URL`.
5. [ ] A Dokploy application with a Docker image source, able to pull from GHCR.

The steps that switch a Dokploy app over to this workflow are not in this repo. They live in the operator's `release` skill.

## Cut a release

1. [ ] Preview it: `gh workflow run "Create release" --ref main -f bump=patch -f dry_run=true`. The run log and summary show the next version and the commit subjects since the last tag. Nothing is built, tagged, or deployed.
2. [ ] Ship it: `gh workflow run "Create release" --ref main -f bump=patch`. Use `minor` or `major` as needed.

The Git tag is the version. The `version` fields in `package.json` mean nothing here. Release notes come from GitHub (`--generate-notes`).

The Discord line reads `✅ <repo> prod deploy succeeded — vX.Y.Z (<12>) — <run url>`, or `❌ <repo> prod deploy failed — …` for any other outcome.

## Roll back

```sh
gh workflow run "Create release" --ref main -f redeploy=v1.2.3
```

`redeploy` skips the build and the tag. It points Dokploy at that release's `prod-sha-<12>` image and runs the same health wait and notify. Nothing is rebuilt. The same command redeploys the current version.

A container rollback is not a database rollback. If the release ran a migration, the old image meets the new schema.

## What may differ per project

These sit at the top of the workflow file, or on the job:

- `DOCKERFILE` and `BUILD_CONTEXT`: the Dockerfile path and the build context.
- `RELEASE_MARK_LATEST`: `"true"` or `"false"`, passed to `gh release create --latest`. Use `"false"` when another release line in the repo, such as `cli-v*`, should keep the Latest badge.
- `HEALTH_PATH`: the health path, if the project changes it and keeps the body contract.
- `runs-on`: the runner labels.

Keep the rest the same in every copy: build before tag, the immutable `prod-sha-<12>` tag, the Dokploy deploy title, the Discord line format, and actions pinned to full SHAs. `fx release verify` checks the title, the image tag, and the Discord line. The copies are kept in step by hand, so port a fix here as well as to the project.
