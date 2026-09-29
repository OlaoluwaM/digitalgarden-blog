# ADR 0007: Gate Production Deploys on CI Through Vercel Deployment Checks

- **Status:** Accepted
- **Date:** 2026-09-29

## Context

Vercel's GitHub integration builds every push. A push to `main` goes live
on thunk.blog as soon as Vercel's own build succeeds; it does not wait for
the GitHub Actions workflow (`.github/workflows/ci.yml`: typecheck, lint,
format check, every test suite, and the build). A commit that fails CI can
therefore be live before its checks finish. Most commits to `main` come
from the Digital Garden plugin, which commits published notes directly to
`main`, not through a pull request.

Options considered:

- **Branch protection on `main`,** requiring CI before a pull request
  merges. The plugin's direct commits would either be blocked, which stops
  publishing, or allowed to bypass the rule, which leaves them ungated.
- **Deploy from CI.** Turn off Vercel's automatic deploys for `main`
  (`git.deploymentEnabled`) and deploy from the workflow with the Vercel
  CLI after the tests pass. Gates every commit, but needs a Vercel token
  stored as a GitHub secret, and moves the production build into CI.
- **Vercel Deployment Checks.** Vercel keeps building every push, but
  holds a production deployment off the production domain until required
  checks pass. The Hobby plan includes it. Vercel's
  `vercel/repository-dispatch/actions/status` action reports a workflow
  job's result as a GitHub commit status that a check can require.

## Decision

- The CI job's first step is `vercel/repository-dispatch/actions/status`
  (pinned to a commit; Dependabot updates it). It sets the commit status
  `Vercel - digitalgarden-blog: CI` to pending when the job starts, and to
  success or failure when it ends, from the job's step results. The job
  has `statuses: write` and `actions: read` for it.
- The Vercel project requires that status under Settings > Build and
  Deployment > Deployment Checks (a GitHub Actions check named `CI`).
  A production deployment takes thunk.blog only once it passes.
- The check is added after the merge into `main`, once the workflow has
  run there ([TODO.md](../../TODO.md)): until then `main` has no workflow,
  and production would wait for a status that never comes.
- Preview deployments are not gated, and `vercel.json` does not change.

## Consequences

**Positive**

- Every commit on `main` is gated, including the plugin's direct commits,
  with no change to how publishing works.
- No long-lived Vercel token to store, scope, or rotate.
- Vercel still builds and deploys as before; previews are unchanged.

**Negative / trade-offs**

- A publish goes live only after CI finishes (about two to three minutes
  on GitHub's runners), and a failing or flaky test holds up publishing
  until it is fixed or the deployment is promoted by hand in Vercel.
- The site is built twice per commit: once by Vercel (the deployed build)
  and once in CI (the tested build). They build the same commit, but CI
  does not test the exact artifact that is deployed.
- Superseded runs are cancelled, so an older commit's status stays pending
  and only the newest commit on `main` goes live.
- On a pull request the status is set on GitHub's temporary merge commit,
  not the branch's head, so it does not appear on the pull request page;
  the `test` check does.
- The gate depends on a Vercel dashboard setting outside the repository,
  and on Vercel's action continuing to set the status by name.
