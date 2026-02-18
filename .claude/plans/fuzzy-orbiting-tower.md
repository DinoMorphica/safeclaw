# Plan: Associate Read Content with Write Activities

## Problem

When an AI agent reads a file and then edits it within the same interaction, the current system produces 4 activities:

1. `file_read` — "Read /path/file" (no content)
2. `file_read` — "Read /path/file [result]" (contentPreview = full file content)
3. `file_write` — "Edit /path/file" (no content)
4. `file_write` — "Edit /path/file [result]" (contentPreview = "Successfully replaced text in...")

The Write result only shows the edit confirmation message. The user wants Write activities to also include the content that was read beforehand, so they can see **what the agent read before editing** when reviewing a Write activity.

## Solution: `readContentPreview` Field

Add a new field `readContentPreview` to Write activities that captures the file content from the preceding Read within the same interaction (runId).

### How it works in the session watcher:

1. Maintain an in-memory map: `recentReadContent: Map<string, string>` keyed by `"{runId}:{targetPath}"`
2. When a `file_read` tool result arrives with content, store it in the map
3. When a `file_write` tool result arrives for the same file path in the same runId, look up the stored read content and attach it as `readContentPreview`
4. Clear map entries when the runId changes (new user message starts a new interaction)

---

## Implementation Steps

### Step 1: Shared Types

**File:** `packages/shared/src/types.ts`

- Add `readContentPreview: string | null` to the `AgentActivity` interface

### Step 2: Shared Schemas

**File:** `packages/shared/src/schemas.ts`

- Add `readContentPreview: z.string().nullable()` to `agentActivitySchema`

### Step 3: Database Schema

**File:** `apps/cli/src/db/schema.ts`

- Add `readContentPreview: text("read_content_preview")` column to `agentActivities`

### Step 4: Database Migration

**File:** `apps/cli/src/db/migrate.ts`

- Add idempotent `ALTER TABLE agent_activities ADD COLUMN read_content_preview TEXT` (same pattern as existing v0.2.0 migration)

### Step 5: Session Watcher (core logic)

**File:** `apps/cli/src/services/session-watcher.ts`

Changes:

- Add `readContentPreview: string | null` to `SessionFileActivity` interface
- Add `private recentReadContent = new Map<string, string>()` to track read content by `runId:targetPath`
- In `processEntry()` when `role === "user"`: clear entries for the previous runId from `recentReadContent`
- In `processEntry()` when handling `toolResult` for a `file_read`: store content in `recentReadContent` keyed by `"{runId}:{targetPath}"`
- In `processEntry()` when handling `toolResult` for a `file_write`: look up `recentReadContent.get("{runId}:{targetPath}")` and attach as `readContentPreview` on the emitted activity
- All non-write activities emit `readContentPreview: null`

### Step 6: Monitor Pipeline

**File:** `apps/cli/src/services/openclaw-monitor.ts`

- Add `readContentPreview` to the `handleActivity` parameter shape
- Pass `readContentPreview` through to DB insert and Socket.IO emission
- Gateway WS activities (from client) set `readContentPreview: null`

### Step 7: Frontend Display

**File:** `apps/web/src/components/ActivityDetails/renderers/FileOperationRenderer.tsx`

- For `file_write` activities: if `activity.readContentPreview` exists, render an "Original Content (before edit)" collapsible/section above the edit result
- Keep existing `contentPreview` display for the edit result itself

---

## Files to Modify

| File                                                                          | Change                                      |
| ----------------------------------------------------------------------------- | ------------------------------------------- |
| `packages/shared/src/types.ts`                                                | Add `readContentPreview` to `AgentActivity` |
| `packages/shared/src/schemas.ts`                                              | Add field to Zod schema                     |
| `apps/cli/src/db/schema.ts`                                                   | Add column                                  |
| `apps/cli/src/db/migrate.ts`                                                  | Add ALTER TABLE                             |
| `apps/cli/src/services/session-watcher.ts`                                    | Core logic: track reads, attach to writes   |
| `apps/cli/src/services/openclaw-monitor.ts`                                   | Pass new field through pipeline             |
| `apps/web/src/components/ActivityDetails/renderers/FileOperationRenderer.tsx` | Display read content on write activities    |

---

## Verification

1. `pnpm build:shared && pnpm typecheck` — Types compile
2. `pnpm clean && pnpm build` — Full build passes
3. Manual test: Have OpenClaw read then edit a file. Verify the Write activity in the dashboard shows the "Original Content" section with what was read before the edit.
