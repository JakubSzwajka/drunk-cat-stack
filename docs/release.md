# Gated release

This repo carries the reference copy of the gated release profile. It is three GitHub Actions workflows and the scripts they call. A merge to `main` ships nothing. A person runs **Create release**, and that run is the approval.

The template has no Dockerfile and no health endpoint, so the workflows never run here. They start only by hand (`workflow_dispatch`), never on push or pull request. `ci.yml` is separate and unchanged.

## The files

| File | Workflow name | What it does |
| --- | --- | --- |
| `.github/workflows/release-create.yml` | Create release | Builds the image, picks the next `vX.Y.Z`, writes notes from commit subjects, tags, publishes the GitHub Release, aliases the image, then calls Deploy prod |
| `.github/workflows/release.yml` | Publish image | Builds one `main` commit into `ghcr.io/<owner>/<repo>:prod-sha-<12>`, named after the repo in lowercase. Moves no other tag |
| `.github/workflows/deploy-prod.yml` | Deploy prod | Resolves a `vX.Y.Z` tag to its commit, runs the preflight, points Dokploy at the `prod-sha` image, waits for the new commit at `APP_URL/api/health`, and posts one notify line |
| `scripts/ci/dokploy-deploy.sh` | | Sets the Dokploy app's image and waits for the deployment |
| `scripts/ci/preflight-dokploy-env.sh` | | Fails the deploy if the runtime env names a Swarm task-scoped hostname |
| `scripts/ci/smoke-commit.sh` | | Polls `/api/health` until it answers 200 with the new commit |
| `scripts/ci/smoke-http.sh` | | Polls a URL until it answers 200; a spare helper for extra smoke checks |
| `scripts/ci/slack-notify.sh` | | Posts the outcome to a Slack-compatible webhook; silent when the secret is empty |
| `scripts/ci/*.test.sh` | | Tests for the preflight and the commit smoke check. Run them with `bash` |

The flow:

```text
Create release (dispatch on main)
  ├─ build:  Publish image ──> ghcr.io/<owner>/<repo>:prod-sha-<12>
  ├─ tag:    vX.Y.Z tag + GitHub Release, image aliased vX.Y.Z, prod-latest, latest
  └─ deploy: Deploy prod(vX.Y.Z)
               preflight ─> Dokploy deploy ─> smoke-commit ─> notify
```

The build runs before the tag, so a failed build never leaves a tag behind.

## What a project needs

1. [ ] A `Dockerfile` at the repo root that bakes in the commit:

   ```dockerfile
   ARG APP_COMMIT=unknown
   ENV APP_COMMIT=$APP_COMMIT
   ```

2. [ ] A health endpoint at `/api/health`. It returns HTTP 200 with this body, where `commit` is the first 12 characters of `APP_COMMIT`:

   ```json
   {"status":"ok","commit":"0123456789ab"}
   ```

3. [ ] Repo secrets: `DOKPLOY_API_KEY` and `SLACK_DEPLOY_WEBHOOK`. The webhook may be empty; the notify step then does nothing.
4. [ ] Repo variables: `DOKPLOY_BASE_URL`, `DOKPLOY_APPLICATION_ID`, and `APP_URL`.
5. [ ] A Dokploy application with a Docker image source, able to pull from GHCR.

The steps that switch a Dokploy app over to this profile are not in this repo. They live in the operator's `release` skill (its devops reference).

## Cut a release

1. Open **Actions > Create release** and run it on `main`.
2. Pick `patch`, `minor`, or `major`, or type an exact `version` such as `v1.0.0`.
3. Tick `dry_run` first to see the next version and the notes. A dry run builds, tags, and deploys nothing.
4. Run it again without `dry_run`. Untick `deploy` to tag and publish without shipping.

The Git tag is the version. The `version` fields in `package.json` mean nothing here.

## Roll back

Run **Deploy prod** by hand with an older `vX.Y.Z`. It points Dokploy at that release's `prod-sha` image. Nothing is rebuilt. An empty `version` deploys the newest tag.

A container rollback is not a database rollback. If the release ran a migration, the old image meets the new schema.

## What may differ per project

- The health path and body, if the project changes `SMOKE_PATH` and the health contract together.
- The smoke timeouts (`SMOKE_TIMEOUT`, `SMOKE_DELAY`) and the Dokploy wait (`DOKPLOY_DEPLOY_TIMEOUT`).
- The `Dockerfile` path and build context in `release.yml`.
- Where the notify line goes, or no notify at all.
- Extra smoke checks with `smoke-http.sh`.

Keep these the same in every copy: build before tag, the immutable `prod-sha-<12>` tag, the ancestor-of-`main` checks, the preflight, the commit smoke check, and actions pinned to full SHAs. The copies are kept in step by hand, so port a fix here as well as to the project.
