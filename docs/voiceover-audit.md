# VoiceOver & Voice Control Accessibility Audit — tweb (2bj fork)

**Date:** 2026-09-07  
**Scope:** macOS VoiceOver (VO) and Voice Control (VC) — Show Numbers / named Click  
**Repo:** `https://github.com/2bj/tweb` (`master`)  
**Method:** Static code review + existing Vitest a11y tests. No live Telegram session required; runtime behaviour marked where inferred.

**User context:** Voice-only / paralyzed user. Primary success = VC can **name and activate** controls; VO can **navigate landmarks**, hear **meaningful names**, and **activate** without pointer precision.

---

## 1. Executive summary

This fork has shipped a solid **progressive ARIA layer** in `src/helpers/accessibility.ts` covering the **chat list**, **folder navigation**, **message feed**, **composer core**, **scroll controls**, **message/chat menus**, and **attach menu items**. Vitest coverage exists for these helpers (`voiceOverAccessibility.test.ts`, `chatListScrollAccessibility.test.ts`, `dialogChatMenu.test.ts`, `attachMenuAccessibility.test.ts`, `buttonMenuAccessibility.test.ts`, `messageMenuButton.test.ts`).

**Remaining blockers (P0)** cluster around three patterns:

1. **Activation path mismatch** — chat rows open on `mousedown`, not `click`; VO/VC synthesize `click`, so “open chat” likely fails even when the row is named.
2. **Icon-only chrome** — sidebar header (burger/back, tools menu, search), chat topbar, and most composer secondary buttons use `ButtonIcon` / `createButtonIcon()` with **`tabIndex = -1`** and **no `aria-label`**.
3. **Overlay & feedback silence** — modals lack dialog semantics/focus trap; toasts have no live region; settings navigation rows are mostly unlabeled `<div>` click targets.

Secondary gaps (P1): reactions, service messages, sponsored UI, media viewer, selection mode, voice recording panel, stories carousel, archive row, forum tabs, and sparse `ignoreMove` outside attach/chat-menu.

**Recommended first ship:** Fix chat-row activation + label sidebar header search/tools/back (unblocks open/read/reply path). **Second ship:** Topbar + composer Send/emoji labels and tab order. **Third ship:** Popup dialog contract + toast live regions.

---

## 2. What's already good

Infrastructure and patterns to reuse:

| Area | What works | Key files |
|------|------------|-----------|
| **Central helpers** | Landmarks, dialog/bubble/folder naming, scroll controls, hit-target reduction | `src/helpers/accessibility.ts` |
| **Vitest coverage** | Helpers + attach menu + chat menu + scroll buttons | `src/tests/voiceOverAccessibility.test.ts`, `chatListScrollAccessibility.test.ts`, `dialogChatMenu.test.ts`, `attachMenuAccessibility.test.ts`, `buttonMenuAccessibility.test.ts`, `messageMenuButton.test.ts` |
| **Design docs** | MVP + folders follow-ups (mostly implemented) | `docs/superpowers/specs/2026-09-06-tweb-voiceover-mvp-design.md`, `docs/superpowers/specs/2026-09-07-folders-navigation-a11y-design.md` |

### Sidebar

| Feature | Details | Key files |
|---------|---------|-----------|
| Chat list landmark | `role="navigation"`, `aria-label` = FilterChats | `appDialogsManager.ts` → `applyChatNavigationLandmark` |
| Virtual list semantics | `role="list"` on chat lists | `sortedDialogList.ts`, `accessibility.ts:applyChatListAccessibility` |
| Dialog rows | `role="listitem"`, composed `aria-label`, `aria-current`, decorative children hidden | `accessibility.ts:applyDialogRowAccessibility`, `refreshDialogRowAccessibility` |
| Stories on avatar | Separate `button.dialog-stories-button`, `aria-label` = Stories | `accessibility.ts:applyDialogStoriesButton` |
| Chat menu (active row) | Native `<button>`, `aria-label` = Chat menu, `ignoreMove: true` | `accessibility.ts:createDialogChatMenuButton`, `syncDialogChatMenuButton` |
| Scroll controls | Native buttons **Chat list up** / **Chat list down**; list `tabIndex=0` + PageUp/Down | `accessibility.ts:applyChatListScrollAccessibility`, `autonomousDialogList/base.ts` |
| Folder tabs (horizontal) | `role="navigation"` + folder items as `role="button"` + Enter/Space | `foldersTabs.tsx` |
| Folders sidebar (vertical) | Landmark, folder items, menu = OpenMenu, equalizer labeled | `foldersSidebarContent/index.tsx`, `folderItem.tsx` |
| Create FAB | `role="button"`, `aria-label`, `aria-expanded`, keyboard | `sidebarLeft/index.ts` (~1104–1119) |
| Folder scroll-controls fix | `relocateChatListScrollControls` keeps controls as siblings (empty-list case) | `accessibility.ts:relocateChatListScrollControls` |

### Chat

| Feature | Details | Key files |
|---------|---------|-----------|
| Messages feed | `role="region"`, title includes chat name | `bubbles.ts` → `applyMessagesFeedLandmark`, `updateMessagesFeedLandmark` |
| Regular bubbles | `role="article"`, async `aria-label` (author, text, time, direction) | `accessibility.ts:applyBubbleAccessibility`, `bubbles.ts` |
| Date separators | `role="heading"`, `aria-level="2"` | `dateBubble.ts`, `accessibility.ts:applyDateBubbleAccessibility` |
| Message menu | Native `<button>`, `aria-label` = Message menu | `messageMenuButton.ts` |
| Composer landmark | `role="region"`, SendMessageTitle | `input.ts` → `applyComposerLandmark` |
| Message input | `role="textbox"`, `aria-multiline`, label Message | `accessibility.ts:applyMessageInputAccessibility` |
| Attach toggle | `role="button"`, `tabIndex=0`, label Attach, **`ignoreMove: true`** | `input.ts`, `accessibility.ts:applyAttachButtonAccessibility` |
| Attach menu items | Photo/Video & Document rows get `role="button"` + `aria-label` | `buttonMenu.ts`, tested in `attachMenuAccessibility.test.ts` |
| Code block copy | `ignoreMove: true` on copy control | `bubbles.ts` (~1361) |

### Overlays (partial)

| Feature | Details | Key files |
|---------|---------|-----------|
| ButtonMenu items | Plain rows: `role="button"`, Enter/Space; checkbox/radio native + `aria-labelledby` | `buttonMenu.ts`, `buttonMenuAccessibility.test.ts` |
| Popup footer actions | Native `<button class="popup-button">` | `popups/index.ts`, `popups/indexTsx.tsx` |
| Escape stack | Popups/menus/toasts/settings-search in nav controller | `appNavigationController.ts`, `overlayClickHandler.ts` |
| Call buttons (reference) | Native buttons + `aria-label` | `call/button.ts` |
| New authorization | `role="alert"`, `aria-live="assertive"` | `newAuthorization.tsx` |
| Some settings tabs | Sessions/automation rows with `role="button"` | `activeSessions.tsx`, `chatAutomation.tsx` |

---

## 3. Gaps — prioritized table

Priorities: **P0** = blocks core chat by voice; **P1** = frequent secondary flows; **P2** = polish / rare screens.

| Priority | Surface | Issue | Why it breaks VO / Voice Control | Suggested fix (smallest) | Key files |
|----------|---------|-------|----------------------------------|--------------------------|-----------|
| **P0** | Sidebar — chat list | Dialog open wired to **`mousedown` only**; capture `click` cancels `<a>` navigation | VO (Ctrl+Opt+Space) and VC “Click …” fire **click**, not mousedown — named row may not open chat | Shared activation handler for `mousedown` + `click` + Enter/Space on row; or `attachClickEvent` on rows with `ignoreMove` where needed | `appDialogsManager.ts:2158–2331` (`setListClickListener`) |
| **P0** | Sidebar — header | `.sidebar-back-button` is unlabeled `<div>` (burger/back) | VC cannot “Click menu/back”; VO hears unnamed control | `<button>` or `role="button"` + dynamic `aria-label` (OpenMenu / Back) + `aria-expanded` when menu open | `index.html:93–95`, `sidebarLeft/index.ts:429–438`, `:1579–1590` |
| **P0** | Sidebar — tools menu | `createToolsMenu()` → icon-only `ButtonMenuToggle` (no folders sidebar path) | Archive, Settings, Contacts unreachable by name | Mirror create-FAB: `aria-label` (OpenMenu), `aria-expanded`, Enter/Space | `sidebarLeft/index.ts:666–887`, `buttonMenuToggle.ts` |
| **P0** | Sidebar — search | `InputSearch` with blank placeholder; clear/back icons unlabeled | VC cannot “Click search”; VO lands on unnamed field | `aria-label` on input; label clear/back controls | `sidebarLeft/index.ts:154–157`, `inputSearch.ts` |
| **P0** | Chat — topbar | All header icons (search, call, video, overflow, back) — icon-only, no `aria-label` | VC cannot activate header actions by name | Per-control `aria-label` at call sites (reuse lang keys) | `topbar.ts`, `buttonIcon.ts`, `buttonMenuToggle.ts` |
| **P0** | Chat — topbar info | Chat title area opens profile via pointer on container; not a named control | VC cannot “Click [chat name]” for chat info | Named button/link on `.chat-info` with title + subtitle label | `topbar.ts` (~256–283, ~1357–1368) |
| **P0** | Composer — Send | `createButtonIcon()` forces **`tabIndex = -1`**; label always “Send” while icon = record/edit/schedule | Removed from tab order; wrong name for record/edit modes | `tabIndex = 0`; update `aria-label` in `updateSendBtn()` per mode | `input.ts:629–637`, `updateSendBtn`, `applySendButtonAccessibility` |
| **P0** | Composer — emoji | Emoji/keyboard toggle: `tabIndex = -1`, no label, no expanded state | VC cannot “Click emoji”; unnamed in rotor | Label + `aria-expanded`; restore tab order | `input.ts`, `emoticonsDropdown/index.ts` |
| **P0** | Composer — reply/edit bar | Reply preview + cancel are unlabeled icons; wrapper is `<div>` | Cannot cancel reply or jump to quoted message by voice | Region label + “Cancel reply” + named preview button | `input.ts` (`constructReplyElements`, `setTopInfo`) |
| **P0** | Chat — service messages | Service bubbles return early — **skip** `applyBubbleAccessibility` | “Joined group”, gifts, etc. silent in VO | Apply `role="status"` or `article` + label from service text | `bubbles.ts` (~7055–7665) |
| **P0** | Chat — reactions | `reaction-element` custom elements: no role/label/keyboard | VC cannot toggle/react; VO skips controls | `role="button"`, label with emoji + count + selected state | `reaction.ts`, `reactions.ts`, `bubbles.ts` |
| **P0** | Chat — sponsored | In-feed + topbar sponsored: close/menu unlabeled; bubble lacks “Sponsored” | Cannot dismiss/hide ads by voice | Label hide/menu; include Sponsored in bubble name | `bubbles.ts` (~9586–9611), `topbarSponsored.tsx` |
| **P0** | Overlays — modals | No `role="dialog"`, `aria-modal`, focus move, or background `inert` | VO browses obscured chat; Tab escapes modal; VC hits covered controls | Dialog contract on popup show/destroy | `popups/index.ts:335–364`, `popups/indexTsx.tsx` |
| **P0** | Overlays — toasts | Plain `<div class="toast">` — no `aria-live` / `role="status"` | Errors/copy confirmations silent | `role="status"` + `aria-live="polite"` (assertive for errors) | `toast.ts`, `scss/base.scss` (.toast) |
| **P0** | Settings | Most `Row clickable` rows lack `role`/`tabIndex` — div-only | Settings navigation invisible to VO rotor / VC | Default button semantics on clickable rows | `rowTsx.tsx`, `sidebarLeft/tabs/settings.tsx`, `generalSettings.tsx`, … |
| **P1** | Sidebar — collapsed search | `.sidebar-header-search-trigger` — icon div, no label | Search entry hidden when sidebar collapsed | `role="button"` + Search label + keyboard | `sidebarLeft/index.ts:388–393` |
| **P1** | Sidebar — stories strip | Horizontal stories carousel: unlabeled clickable divs | Top stories not in Show Numbers (avatar stories OK) | List/toolbar + named peer buttons | `stories/list.tsx`, `appDialogsManager.ts:1091–1097` |
| **P1** | Sidebar — archive | `<archive-dialog>` styled as row but no row a11y; same mousedown path | Unnamed; shares P0 activation gap | Apply archive label + fix activation | `archiveDialog.tsx`, `appDialogsManager.ts:2170–2174` |
| **P1** | Sidebar — virtual list | No `aria-setsize` / `aria-posinset`; list lacks folder name label | VO loses position in long lists | Set size/position on visible rows; folder name on list | `deferredSortedVirtualList.tsx`, `sortedDialogList.ts`, `accessibility.ts` |
| **P1** | Sidebar — forum tabs | Forum search + overflow menus icon-only | Forum sidebar controls unnamed | Labels on search, more, close | `forumTab/forumTab.ts`, `groupForumTab.ts`, `sliderTab.ts` |
| **P1** | Sidebar — passcode lock | Native button, no `aria-label` (tooltip hover-only) | VC cannot “Click lock” | `aria-label` from PasscodeLock.TapToLock | `lockButton.tsx` |
| **P1** | Chat — pinned/live plates | Pinned message body + unpin/menu unlabeled | Cannot jump/unpin by voice | Named plate + Unpin + menu labels | `pinnedMessage.tsx`, `topbarLive/`, `topbarGroupCall/` |
| **P1** | Chat — in-chat search | Search field/results without ARIA | In-chat search unusable by name | Landmark + labeled field + results list | `topbarSearch.tsx`, `search.ts` |
| **P1** | Chat — bubble side actions | Forward, summarize, transcribe, replies — `<div>` + `attachClickEvent` | VC cannot click beside buttons | Native `<button>` + labels | `bubbles.ts`, `replies.ts`, `roundVideoBubble.ts` |
| **P1** | Chat — media | Photo/video nodes often lack `alt` / `aria-label` | Media-only messages weak in VO | Meaningful alt on media; hide decorative layers | `wrappers/photo*`, `wrapVideo`, bubble render path |
| **P1** | Composer — secondary icons | Schedule, bot keyboard, gift, go-down, record cancel — all `tabIndex=-1`, unlabeled | Large share of composer unnamed | Per-control `aria-label`; restore tab order where needed | `input.ts`, `buttonCorner.ts` |
| **P1** | Composer — voice recording | Cancel/pause/play in panel unlabeled | Cannot control recording by voice | Labels on recording controls | `voiceRecording/voiceRecordingPanel.ts` |
| **P1** | Chat — selection mode | Toolbar + in-message checkbox without checkbox semantics | Multi-select unusable by voice | Toolbar labels; `aria-checked` on selection | `selection.ts`, `inMessageCheckbox.tsx` |
| **P1** | Overlays — menu triggers | Most `ButtonMenuToggle` lack `aria-haspopup` / `aria-expanded` | VO doesn’t announce menu state | Toggle expanded on open/close (FAB pattern) | `buttonMenuToggle.ts`, `contextMenuController.ts` |
| **P1** | Overlays — context menus | No focus move to first item on open | Keyboard/VO users stay on trigger | Focus first menu item on open | `contextMenuController.ts`, `createContextMenu.ts` |
| **P1** | Settings — sliders | Range inputs without `aria-label` / `aria-labelledby` | “Slider” with no purpose | Link label to name + value | `rangeSettingSelector.tsx`, `generalSettings.tsx` |
| **P1** | Settings — structure | Section titles are `<div>`, not headings | VO Headings rotor empty | `role="heading" aria-level="2"` on sections | `section.tsx` |
| **P1** | Settings — sub-tabs | Chat/list not `inert` when settings slider open | VO reads content under settings panel | `inert` / `aria-hidden` on obscured columns | `sidebarLeft/index.ts`, `slider.ts` |
| **P1** | Pattern — `ignoreMove` | Only attach, chat menu, code copy use it in hot paths | VC slight movement can swallow clicks | Audit icon buttons/menus; add `ignoreMove: true` | `clickEvent.ts`, sidebar/chat call sites |
| **P1** | Media viewer | Only Copy button labeled; rest of chrome likely icon-only | Cannot navigate/close/share media by voice | Label close, forward, zoom, etc. | `mediaViewer/index.ts` |
| **P2** | Chat — sticky dates | Floating date on scroll — CSS only, no live region | Current date section not announced while scrolling | Polite live region on sticky date change | `bubbles.ts` (~1370–1396) |
| **P2** | Chat — feed keyboard | Messages region no `tabIndex` / PageUp scroll helper | Keyboard-only scroll harder than chat list | Optional mirror of chat-list scroll pattern | `accessibility.ts`, `bubbles.ts` |
| **P2** | Chat — bubble i18n | `buildBubbleAccessibleName` uses hardcoded English “sent”/“received” | Wrong language in non-English VO | `I18n.format` keys | `accessibility.ts:505–510` |
| **P2** | Chat — async labels | Bubble label applied async — brief unlabeled window | Transient silence on fast scroll | Sync placeholder label, refresh when ready | `bubbles.ts`, `accessibility.ts` |
| **P2** | Sidebar — list DOM | `role="list"` on `<ul>` but rows are `<a role="listitem">` without `<li>` | Some ATs warn on hierarchy | Long-term: `<li>` wrappers or listbox pattern | `appDialogsManager.ts`, `DIALOG_LIST_ELEMENT_TAG` |
| **P2** | Popups — create poll | Media attachment controls: unlabeled `role="button"` divs | Poll creation media step partially inaccessible | Native buttons + labels | `popups/createPoll/mediaAttachment.tsx` |
| **P2** | Settings — search | Settings search input/results semantics unclear | Hard to search settings by voice | Label input; results as listbox/region | `settings.tsx`, `settingsSearchResults.tsx` |
| **P2** | Live region — new messages | No polite announcement for incoming messages (noted as MVP non-goal) | User may miss new messages while focused elsewhere | Optional `aria-live="polite"` region on feed | New helper + `bubbles.ts` hook |

### Unknown without runtime (honest limits)

- Exact VO rotor order when virtual list recycles rows off-screen.
- Whether macOS VC maps `aria-label` lang keys to spoken English phrases vs key strings (depends on app language pack loading).
- Touch/iOS VO behaviour (audit targets macOS desktop).
- Full coverage of 200+ popups — sampled base classes + create poll; other popups inherit base gaps.

---

## 4. Recommended next 3–5 ships (ordered)

### Ship 1 — **Open chat reliably (sidebar activation + header chrome)**

- Fix chat-row activation for `click` + keyboard (P0 `setListClickListener`).
- Label burger/back, tools menu, search field + clear/back (P0 sidebar header).
- Apply archive row naming (`archiveDialog.tsx`).

**Exit criteria:** VC “Click [chat name]” opens chat; “Click search”, “Click open menu”, “Click back” work on sidebar.

### Ship 2 — **Composer voice path (send, attach already OK, emoji, reply bar)**

- Restore Send tab order + dynamic labels (record/edit/schedule).
- Label emoji toggle + `aria-expanded`.
- Reply/edit bar region + cancel + preview labels.

**Exit criteria:** VC can compose reply: focus Message, Send, Attach (already), Emoji, Cancel reply.

### Ship 3 — **Chat chrome (topbar + reactions + service lines)**

- Topbar icon labels + chat info button.
- Service message accessible names.
- Reaction buttons with labels (minimum: open reaction picker from bubble menu already OK via Message menu).

**Exit criteria:** VC can search/call/open chat info from topbar; service lines speak; one reaction path works.

### Ship 4 — **Overlay contract (modals + toasts + menu triggers)**

- Popup: `role="dialog"`, `aria-modal`, focus first control, `inert` background, labeled close.
- Toast: `aria-live` status region.
- `ButtonMenuToggle`: `aria-expanded` / `aria-haspopup` pattern from create FAB.

**Exit criteria:** Modal traps focus; toast errors speak; menus announce expanded state.

### Ship 5 — **Settings & secondary surfaces**

- Default `role="button"` + `tabIndex=0` on clickable `Row`.
- Section headings; slider labels; settings sub-tab `inert`.
- Media viewer + selection mode labels.

**Exit criteria:** VO can navigate Settings headings and activate rows by name; media viewer close/share labeled.

---

## 5. Test / verification notes

### Automated (CI)

```bash
pnpm test src/tests/voiceOverAccessibility.test.ts
pnpm test src/tests/chatListScrollAccessibility.test.ts
pnpm test src/tests/dialogChatMenu.test.ts
pnpm test src/tests/attachMenuAccessibility.test.ts
pnpm test src/tests/buttonMenuAccessibility.test.ts
pnpm test src/tests/messageMenuButton.test.ts
```

Extend tests when fixing gaps (e.g. chat-row click activation, popup dialog attrs, toast live region).

### macOS VoiceOver — manual

1. **Rotor → Landmarks:** expect Chats navigation, Messages region, Send message region, Chat Folders navigation (when folders visible).
2. **Rotor → Form Controls / Buttons:** chat rows named with title + preview; active row shows Chat menu + Stories (if present).
3. **Interact:** Ctrl+Option+Space on focused chat row — **currently likely fails (P0)** until click path fixed.
4. **Messages:** arrow through feed; bubbles announced as articles with author + text; dates as headings.
5. **Composer:** Message textbox, Attach, Send (verify label matches mode).

### macOS Voice Control — Show Numbers / named Click

1. Enable **Voice Control → Overlay → Show Numbers** (or say “Show numbers”).
2. **Sidebar:** numbers on folder tabs; chat rows; **Chat list up/down** scroll buttons; Create / New chats FAB.
3. Say **“Click Chat list down”** — list scrolls (already shipped).
4. Say **“Click [chat name fragment]”** — opens chat (verify after Ship 1).
5. Say **“Click Message menu”** on a bubble; **“Click Attach”**; **“Click Photo or Video”** when menu open.
6. Say **“Click Chat menu”** on active sidebar row — context menu opens.
7. After Ship 2: **“Click Send”**, **“Click emoji”** (or whatever label is set).

### Popup sandbox (no Telegram login)

`?popups=1` on dev server — useful to spot-check popup button labels once dialog semantics land; does not replace VO on real chat flow.

### Regression watchlist

- **`ignoreMove` + `mousedown` stopPropagation** on nested row buttons (chat menu, stories) — tests in `dialogChatMenu.test.ts`, `buttonMenuToggleIgnoreMove.test.ts`.
- **Folder empty list:** scroll controls remain siblings of list container (`relocateChatListScrollControls`).
- **`createButtonIcon` tabIndex = -1`** — any fix must not break mouse-first layout; prefer labels + conditional tab order.

---

## Appendix — pattern reference

| Pattern | Location | Audit note |
|---------|----------|------------|
| Progressive ARIA helpers | `src/helpers/accessibility.ts` | Extend here; don’t duplicate |
| `attachClickEvent` + `hasMouseMovedSinceDown` | `src/helpers/dom/clickEvent.ts` | Default suppresses moved clicks; use `ignoreMove: true` for VC |
| `createButtonIcon` → `tabIndex = -1` | `input.ts:629–637` | Systemic composer exclusion from tab order |
| ButtonMenu “button list” not menu | `buttonMenu.ts:304–308` | Documented tradeoff; OK for VC if items labeled |
| Chat list mousedown-only | `appDialogsManager.ts:2317` comment | Root cause of top P0 |

---

*Audit performed on branch `cursor/voiceover-audit-bbf7` against `master`. No product code changed except this report.*
