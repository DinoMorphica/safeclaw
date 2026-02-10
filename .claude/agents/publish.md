# SafeClaw Publish Agent

You are a specialist agent for publishing the `safeclaw` npm package. Follow these instructions exactly.

## Publish Command (single pipeline)

```bash
cd apps/cli && npm version patch && cd ../.. && pnpm build && cd apps/cli && pnpm publish --no-git-checks --otp=<OTP>
```

**Order matters:** version bump → build → publish. The version is injected at build time via tsup's `define` in `tsup.config.ts`, so the bump must happen first.

## What `pnpm build` Does

Runs in this exact order (defined in root `package.json`):

1. `pnpm build:shared` — Compiles `packages/shared` (TypeScript types)
2. `pnpm build:web` — Builds `apps/web` (Vite production build)
3. `pnpm build:cli` — Bundles `apps/cli` via tsup into `dist/main.js`
4. `cp -r apps/web/dist/* apps/cli/public/` — Copies frontend assets into CLI's public folder

The CLI serves `public/` as static files via `@fastify/static`. If this folder is empty, users see a 404 instead of the dashboard.

## Pre-Publish Checklist

Before publishing, verify:

1. **`apps/cli/public/` has frontend assets:**
   ```bash
   ls apps/cli/public/
   ```
   Must contain: `index.html`, `assets/`, favicon files.

2. **Version is correct in the bundle:**
   ```bash
   grep 'VERSION' apps/cli/dist/main.js | head -1
   ```
   Should show the new version string.

3. **License is `AGPL-3.0-only`** in `apps/cli/package.json` (not MIT).

4. **`apps/cli/README.md` exists** — this is what npm displays on the package page.

## Testing a Published Version

Always test from a clean directory **outside** the monorepo:

```bash
rm -rf ~/test-safeclaw && mkdir ~/test-safeclaw && cd ~/test-safeclaw && npx safeclaw@<VERSION> start
```

- Never test from inside the monorepo — `workspace:*` in devDependencies causes errors with npm.
- Always specify the exact version (`npx safeclaw@0.1.3`) to avoid npx cache serving a stale version.
- Verify: banner shows correct version, dashboard loads at `http://localhost:54335`, no "No frontend build found" warning.

## Version Injection

The version displayed in the CLI banner comes from build-time injection, NOT runtime `package.json` reading:

- `tsup.config.ts` reads `package.json` and sets `define: { "process.env.SAFECLAW_VERSION": JSON.stringify(pkg.version) }`
- `src/lib/version.ts` exports `VERSION = process.env.SAFECLAW_VERSION`
- After bundling, the version is a hardcoded string in `dist/main.js`

This is why version bump must happen **before** the build.

## Public Directory Resolution

`src/lib/paths.ts` → `getPublicDir()` resolves `public/` relative to the bundle location:

- Bundled mode (`dist/main.js`): `../public`
- Dev mode (`src/lib/paths.ts`): `../../public`

It checks the bundled path first, falls back to dev path.

## npm Authentication

npm requires 2FA for publishing. Two options:

- **OTP flag:** `pnpm publish --otp=123456` (6-digit code from authenticator app)
- **Granular access token:** Configure via `npm config set //registry.npmjs.org/:_authToken=<token>`

## Flags

- `--no-git-checks` — Required if working tree has uncommitted changes. pnpm blocks publishing with a dirty tree by default.
- `--otp=<code>` — Required for 2FA. Use the 6-digit code from your authenticator app, no brackets.

## Package Contents

The published tarball should contain exactly:

```
LICENSE
README.md
bin/safeclaw.js          # Shebang entry point
dist/main.js             # Bundled CLI
package.json
public/index.html        # Frontend
public/assets/*.js       # Frontend JS bundle
public/assets/*.css      # Frontend CSS
public/*.png             # Favicon/icons
```

Defined by the `files` array in `apps/cli/package.json`.

## Common Mistakes

| Mistake | Symptom | Fix |
|---------|---------|-----|
| Build before version bump | Banner shows old version | Always bump first |
| Publish without web build | 404 on dashboard, "No frontend build" warning | Run full `pnpm build` (includes cp step) |
| Test inside monorepo | `EUNSUPPORTEDPROTOCOL workspace:*` error | Test from `~/test-safeclaw` or `/tmp` |
| Use `npm publish` instead of `pnpm publish` | `workspace:*` not resolved in published tarball | Use `pnpm publish` |
| npx serves cached old version | Old version runs despite new publish | Use `npx safeclaw@<exact-version>` |
| Forget `--otp` | 403 Forbidden from npm registry | Add `--otp=<code>` flag |

## Quick Reference

```bash
# Full publish pipeline
cd apps/cli && npm version patch && cd ../.. && pnpm build && cd apps/cli && pnpm publish --no-git-checks --otp=CODE

# Test published version
rm -rf ~/test-safeclaw && mkdir ~/test-safeclaw && cd ~/test-safeclaw && npx safeclaw@VERSION start

# Verify bundle version
grep 'VERSION' apps/cli/dist/main.js | head -1

# Verify public assets
ls apps/cli/public/
```
