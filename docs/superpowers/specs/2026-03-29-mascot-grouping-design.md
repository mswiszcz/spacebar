# Mascot Grouping by Project Directory

## Overview

Add project-based grouping to Spacebar mascots. Sessions registered from the same `pwd` are visually grouped together in the bar and tray menu. Group names default to the last path segment of `pwd` and can be renamed by right-clicking the group label.

## Data Model

### Backend (Rust)

New `Group` struct in `state.rs`:

```rust
pub struct Group {
    pub group_id: String,         // hex-encoded SHA-256 of pwd, truncated to 16 chars (or "anonymous" for the anonymous group)
    pub pwd: Option<String>,      // full path, None for anonymous group
    pub display_name: Option<String>, // last path segment or user-renamed, None for anonymous
    pub session_ids: Vec<String>,
    pub created_at: u64,
}
```

`SessionStore` gains:
- `groups: HashMap<String, Group>` keyed by `group_id`
- Find-or-create logic when sessions register with a `pwd`

`Session` gains:
- `pwd: Option<String>` — raw pwd from CLI
- `group_id: String` — which group this session belongs to

### Frontend (TypeScript)

New `Group` interface in `state.ts`:

```typescript
interface Group {
  groupId: string;
  pwd: string | null;
  displayName: string | null;
  sessionIds: string[];
}
```

`SessionState` gains:
- `groups: Map<string, Group>`
- Group-level event emission to subscribers

### Config Persistence

In `~/.spacebar/config.json`, new field:

```json
{
  "groupRenames": {
    "/Users/mswiszcz/Labs/spacebar": "My App",
    "/Users/mswiszcz/Labs/other-project": "Side Project"
  }
}
```

Maps `pwd` (full path) to custom display name. Checked when a group is created — if a mapping exists, the custom name is used instead of the last path segment.

## CLI Changes

### `spacebar register`

The CLI automatically reads `$PWD` from its environment and includes it in the registration payload. No hook changes needed.

New optional flag:
- `--group <name>` — overrides the display name (pwd is still sent for grouping identity)

```bash
# Default: pwd captured automatically
spacebar register --agent claude-code --session-id "sess-123" --on-click "..."
# Sends: { agent, sessionId, onClick, pwd: "/Users/mswiszcz/Labs/spacebar" }

# With override
spacebar register --agent claude-code --session-id "sess-123" --on-click "..." --group "My App"
# Sends: { agent, sessionId, onClick, pwd: "/Users/mswiszcz/Labs/spacebar", displayName: "My App" }
```

## API Changes

### Modified HTTP Endpoints

**`POST /register`** — accepts new optional fields:
- `pwd: Option<String>` — working directory
- `displayName: Option<String>` — display name override from `--group` flag

Backend behavior on register:
1. If `pwd` is present: compute `group_id` as hex-encoded SHA-256 of pwd, truncated to 16 chars
   - Group exists → add session to `session_ids`
   - Group doesn't exist → create group, check `config.groupRenames` for custom name, else use last path segment (or `displayName` override if provided)
   - Emit `group-added` (new group) or `group-updated` (existing group)
2. If `pwd` is absent: add session to anonymous group (fixed `group_id`, no display name)

**`POST /remove`** — unchanged request format. Backend additionally:
- Removes session from its group's `session_ids`
- If group becomes empty → remove group, emit `group-removed`
- Otherwise → emit `group-updated`

### New Tauri Command

**`rename_group(group_id: String, display_name: String)`**
- Updates `Group.display_name` in `SessionStore`
- Saves `pwd → display_name` mapping to `config.groupRenames`
- Emits `group-updated` event

### New Tauri Events

- `group-added` — `{ groupId, pwd, displayName, sessionIds }`
- `group-updated` — `{ groupId, displayName, sessionIds }`
- `group-removed` — `{ groupId }`

## Frontend Rendering

### Grid Structure

Every mascot lives inside a group container. No loose mascots.

```html
<div class="mascot-grid">
  <div class="mascot-group" data-group-id="abc123">
    <div class="group-label">spacebar</div>
    <div class="group-mascots">
      <div class="mascot-item" data-session-id="sess-1">...</div>
      <div class="mascot-item" data-session-id="sess-2">...</div>
    </div>
  </div>
  <div class="mascot-group" data-group-id="def456">
    <div class="group-label">other-project</div>
    <div class="group-mascots">
      <div class="mascot-item" data-session-id="sess-3">...</div>
    </div>
  </div>
  <div class="mascot-group anonymous" data-group-id="anon">
    <div class="group-label"></div><!-- empty, spacer preserves alignment -->
    <div class="group-mascots">
      <div class="mascot-item" data-session-id="sess-4">...</div>
    </div>
  </div>
</div>
```

### Container Styling

- Subtle rounded border (`1px solid rgba(255,255,255,0.08)`) and slightly raised background (`rgba(255,255,255,0.06)`)
- Group label: small, muted, uppercase text above mascots
- Spacing between groups wider than spacing between mascots within a group
- Anonymous group container is visually identical but with no label text (spacer preserves vertical alignment)
- Works in both horizontal and vertical orientations

### Right-Click Rename

- Right-click on a named group's `group-label` opens a context menu with "Rename group"
- Clicking it turns the label into an inline text input
- Enter or blur confirms → calls `rename_group` Tauri command
- Escape cancels
- Not available on anonymous groups

## Tray Menu

Groups are reflected in the tray menu as labeled sections:

```
Spacebar
─────────
spacebar
  ├ sess-1 (thinking)
  └ sess-2 (idle)
other-project
  └ sess-3 (error)
─────────
  └ sess-4 (idle)          ← anonymous group, no header
─────────
Preferences...
Quit
```

`rebuild_tray_menu` in `lib.rs` iterates groups instead of flat sessions, nesting sessions under group labels.

## Group Ordering

Groups appear in the order the first session from each group registers (registration order). No sorting or drag-to-reorder.

## Lifecycle Summary

| Event | Backend Action | Events Emitted |
|-------|---------------|----------------|
| Register (new group) | Create group + add session | `group-added`, `session-added` |
| Register (existing group) | Add session to group | `group-updated`, `session-added` |
| Remove (group has others) | Remove session from group | `group-updated`, `session-removed` |
| Remove (last in group) | Remove session + remove group | `group-removed`, `session-removed` |
| Rename | Update display name + persist | `group-updated` |

## Backwards Compatibility

- `pwd` is optional in registration. Sessions without `pwd` go into a single anonymous group.
- Existing hooks don't need changes — the CLI auto-captures `$PWD`.
- Existing config fields are unchanged; `groupRenames` is a new additive field.
