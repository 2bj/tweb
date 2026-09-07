# Folders navigation a11y — tweb

Follow-up to [VoiceOver / screen-reader MVP](./2026-09-06-tweb-voiceover-mvp-design.md).

## Problem

Chat-folder navigation exists in two UIs — horizontal `#folders-tabs` and vertical `#folders-sidebar` — but both are plain clickable `div`s with no roles, tabindex, landmarks, or accessible names. VoiceOver Show Numbers therefore exposes no numbered targets for switching folders.

## Approach

Same progressive ARIA pattern as the MVP: helpers in `src/helpers/accessibility.ts`, applied to existing DOM — no layout rewrite.

**Pattern: `navigation` + `button` (not `tablist` / `tab`).** Folder choice is mutually exclusive, but full tab semantics imply arrow-key roving, which remains out of scope. Named buttons match the chat-list / composer MVP and give Show Numbers interactive anchors immediately.

| Surface | Landmark | Items |
|---|---|---|
| `#folders-tabs` (and other `FoldersTabs` mounts, e.g. forward popup) | `role="navigation"`, `aria-label` = `ChatList.Filter.List.Title` | Each folder tab: `role="button"`, `tabindex="0"` |
| `#folders-sidebar` | Same landmark on the sidebar root | Each `.folders-sidebar__folder-item`: same button semantics |

**Per-item label:** `joinAccessibleParts([folderTitle, unreadSummary])` via `buildFolderAccessibleName`. Unread uses the same lang keys as dialog rows where practical (`messages` / muted). Selected item: `aria-current="true"`. Decorative icon and visible badge: `aria-hidden="true"` so the name is not doubled.

**Sidebar chrome (also buttons):**
- Menu (tools / burger via `createToolsMenu`) → named button; pick/add a lang key at implementation (do **not** reuse `Settings` — different surface)
- Equalizer (opens Chat Folders settings tab) → `ChatList.Filter.List.Title`
- «Add Chats» floating control → `role="button"` + `tabindex="0"` (visible text already names it)

**Helpers (names):**
- `applyFoldersNavigationLandmark(element)`
- `buildFolderAccessibleName(state)`
- `applyFolderItemAccessibility(element, state)`

**Wiring:**
- `src/components/foldersTabs.tsx` — landmark on menu; apply item a11y from `useFolders()` (title, unread, selected)
- `src/components/sidebarLeft/foldersSidebarContent/folderItem.tsx` — button semantics + label; hide icon/badge from AT
- `src/components/sidebarLeft/foldersSidebarContent/index.tsx` — landmark on `#folders-sidebar`; label menu / equalizer / add-chats
- Selected / unread updates stay reactive through Solid props (no chatlist-style recycle refresh)
- Minimal Enter/Space → activate when the host does not already handle keydown; **no** arrow roving

**Tests:** extend `src/tests/voiceOverAccessibility.test.ts` (or adjacent file) for landmark, label+unread, `aria-current`, decorative `aria-hidden`.

## Success criteria

- With folders present, both horizontal and vertical folder controls appear in the accessibility tree as named buttons under a Chat Folders navigation landmark.
- Selected folder exposes `aria-current="true"`; unread is included in the accessible name when non-zero.
- Vitest covers the new helpers; existing a11y tests still pass.
- Manual check: VoiceOver Show Numbers lists folder items (and sidebar menu / settings) as numbered targets.

## Non-goals

- Arrow-key / roving tabindex between folders
- Live region for folder unread changes
- Visual redesign of either folders UI
- Changing default `tabsInSidebar` / removing horizontal tabs
- Replacing `div` items with native `<button>` elements (ARIA on existing nodes is enough for MVP)
