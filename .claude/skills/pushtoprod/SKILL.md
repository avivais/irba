---
name: pushtoprod
description: Update PROJECT_STATE.md, commit all staged/unstaged changes, push to origin/main, deploy to EC2, then verify GitHub CI passes. If CI fails, fix the issues and repeat commit→push→deploy→verify.
---

# Push to Production

Full pipeline: update docs → commit → push → deploy → verify CI.

## Steps

### 1. Update PROJECT_STATE.md

Read the current `PROJECT_STATE.md` and update it to reflect any changes made since the last documented state. Focus on:
- New features or UI changes — add to the relevant "What exists today" section
- Bug fixes — note them inline where relevant
- Mark roadmap items ✅ DONE if completed

### 2. Commit

Stage all modified/new files:
```bash
git add -A
```

Write a clear commit message summarising what changed. Use the recent `git log --oneline -5` for style reference. Include the Co-Authored-By trailer:
```
Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

### 3. Push

```bash
git push origin main
```

### 4. Deploy

```bash
./scripts/deploy.sh
```

Run in background, wait for completion, verify the health check line shows `"status":"ok"` and the correct commit hash.

### 5. Verify CI

Wait ~60 seconds after push for CI to start, then poll until complete:

```bash
# Get the run ID for the latest push to main
gh run list --branch main --limit 1 --json databaseId,status,conclusion

# Watch until done (re-run if still in_progress/queued)
gh run view <run-id> --json status,conclusion,jobs
```

If conclusion is `failure`:
1. Fetch the failed logs: `gh run view <run-id> --log-failed`
2. Identify and fix the issue (lint errors, type errors, test failures)
3. Stage the fix, commit (new commit — never amend), push, deploy again
4. Re-verify CI

Repeat until CI passes (`conclusion: success`).

## Notes

- Deploy and CI verification can run in parallel after the push (deploy ~3 min, CI ~45s)
- CI checks: lint → test → build (no DB needed)
- Common CI failures: ESLint errors, TypeScript errors, failing unit tests
- Health endpoint: `https://irba.sportgroup.cl/api/health` — verify `version` matches the pushed commit hash
