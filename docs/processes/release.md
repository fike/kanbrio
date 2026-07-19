# Release Process

This document explains how to cut a new versioned release of Kanbrio. The full Keep-a-Changelog format lives at <https://keepachangelog.com/en/1.1.0/>; the SemVer policy lives at <https://semver.org/spec/v2.0.0.html>. The end-to-end automation lives at `.github/workflows/release.yml`.

## Prerequisites

- You are on `main` with the merged release commit at HEAD.
- All Relevant CI jobs are green (`backend`, `frontend`, `cargo-deny`, `cargo-audit`; `e2e` is currently soft-launched with `continue-on-error`).
- The CHANGELOG.md `[Unreleased]` section contains the changes you want to ship.

## When to bump which number

Follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html):

| Before 0.1.0 | Bump rule |
|:---|:---|
| `0.0.X` → `0.0.X+1` | Any change (initial-dev wild west) |
| `0.X.Y` → `0.X.Y+1` | Additive change (new feature, new endpoint, new doc) |
| `0.X.Y` → `0.X+1.0` | Breaking change in API, data schema requiring a migration, or removed feature |

After 1.0.0, standard SemVer applies:

- `1.X.Y → 1.X.Y+1` for backwards-compatible fixes.
- `1.X.Y → 1.X+1.0` for backwards-compatible new features.
- `1.X.Y → 2.0.0` for breaking changes.

## Steps to cut a release

1. **Update `CHANGELOG.md`** — Assuming your release version is `0.X.Y` and today's date is YYYY-MM-DD:
   - Move the contents of the `## [Unreleased]` section to a new `## [0.X.Y] - YYYY-MM-DD` section (placed directly under the Unreleased section).
   - Leave the `## [Unreleased]` header intact and empty, ready to receive the next batch of changes.
   - At the bottom of the file, add a new compare link: ` [0.X.Y]: https://github.com/fike/kanbrio/compare/v0.<prev>.<Z>...v0.X.Y` where `v0.<prev>.<Z>` is the previous tag.
   - Update the `[Unreleased]: ...` link to point to the new tag (`v0.X.Y` instead of the previous release tag at the `...HEAD` side).

2. **Commit the changelog update** — Use Conventional Commits:

   ```bash
   git add CHANGELOG.md
   git commit -m "chore(release): v0.X.Y"
   ```

3. **Create the annotated tag** — Use `git tag -a` so the tag itself carries an annotated message:

   ```bash
   git tag -a v0.X.Y -m "Release v0.X.Y"
   ```

4. **Push main and the tag**:

   ```bash
   git push origin main
   git push origin v0.X.Y
   ```

5. **Automation kicks in** — The `release.yml` GitHub Actions workflow fires on the tag push and:
   - Checks out the full repo with `fetch-depth: 0`.
   - Runs `cargo build --release` and `npm run build`.
   - Extracts the version section from `CHANGELOG.md`.
   - Creates a GitHub Release named `Kanbrio vX.Y.Z` with the extracted changelog body, and attaches the built binary (`apps/api/target/release/kanbrio-api`) and the frontend build (`apps/web/dist/index.html`) as artifacts.

6. **Verify the release** — Open <https://github.com/fike/kanbrio/releases> and confirm the new entry is published with the correct body and artifacts attached.

## Backouts and yanked releases

If the release contains a serious bug or security issue after publication:

1. **Yank** the release in the GitHub Releases UI (the entry remains listed but marked as `[YANKED]` per Keep-a-Changelog 1.1.0).
2. **Add a `[YANKED]` marker** to the corresponding entry in `CHANGELOG.md`:

   ```
   ## [0.X.Y] - YYYY-MM-DD [YANKED]
   ```

3. **Open a hotfix branch** off the yanked tag (`git switch -c hotfix/v0.X.Y.1 v0.X.Y`) with the sole purpose of landing the patch.
4. Cut a new release per the steps above; the resulting new section sits above the yanked section in `CHANGELOG.md`.

## License

Every release artifact is licensed under [AGPL-3.0](../../LICENSE). Per AGPL-3.0 Section 13, anyone who interacts with the service over a network is entitled to receive the source code corresponding to the version being served. The `release.yml` workflow attaches the binary and frontend build to the GitHub Release, and the source is the tagged commit at the same ref — both satisfy Section 13 disclosure.
