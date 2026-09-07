# Folders Navigation A11y Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make horizontal `#folders-tabs` and vertical `#folders-sidebar` folder controls appear as named VoiceOver Show Numbers targets (navigation landmark + buttons).

**Architecture:** Progressive ARIA via helpers in `src/helpers/accessibility.ts` (`navigation` + `button`, not `tablist`). Wire helpers into `FoldersTabs` and `FoldersSidebarContent` / `FolderItem`. No layout rewrite, no roving tabindex.

**Tech Stack:** TypeScript, Solid.js, Vitest, existing `@helpers/accessibility` + `@lib/langPack` (`I18n.format`).

**Spec:** `docs/superpowers/specs/2026-09-07-folders-navigation-a11y-design.md`

## Global Constraints

- Pattern is `role="navigation"` + `role="button"` / `tabindex="0"` — never `tablist` / `tab`.
- Landmark `aria-label` uses lang key `ChatList.Filter.List.Title`.
- No arrow-key roving; no live region; no visual redesign; do not change `tabsInSidebar` default.
- Style: no space after keywords (`if(cond)`), no trailing commas, single quotes (repo oxlint).
- Never hand-edit `src/scripts/out/langPack.strings` — edit `src/lang.ts` only.
- **Commits:** per `AGENTS.md`, do **not** create git commits unless the user explicitly asks. Skip commit steps or leave a “ready to commit” note instead.
- Prefix shell with `rtk` when available; otherwise run the bare command.

---

## File structure

| File | Responsibility |
|---|---|
| `src/helpers/accessibility.ts` | `FolderItemAccessibilityState`, `buildFolderAccessibleName`, `applyFoldersNavigationLandmark`, `applyFolderItemAccessibility` (+ optional chrome helpers) |
| `src/lang.ts` | Add `OpenMenu` (or equivalent) for the sidebar tools control |
| `src/components/foldersTabs.tsx` | Landmark on menu; a11y on each folder tab from `useFolders()` |
| `src/components/sidebarLeft/foldersSidebarContent/folderItem.tsx` | Button semantics, label, hide icon/badge from AT, Enter/Space |
| `src/components/sidebarLeft/foldersSidebarContent/index.tsx` | Landmark on `#folders-sidebar`; labels for menu / equalizer / add-chats |
| `src/tests/voiceOverAccessibility.test.ts` | Unit tests for new helpers |

---

### Task 1: Accessibility helpers + tests

**Files:**
- Modify: `src/helpers/accessibility.ts` (append near existing landmark helpers ~433+)
- Modify: `src/tests/voiceOverAccessibility.test.ts`
- Modify: `src/lang.ts` (add `OpenMenu` next to `ChatMenu` / `MessageMenu`)

**Interfaces:**
- Consumes: `joinAccessibleParts`, `I18n.format` (same as dialog helpers)
- Produces:
  ```ts
  export type FolderItemAccessibilityState = {
    title: string,
    unreadCount?: number,
    isMuted?: boolean,
    selected?: boolean
  };

  export function buildFolderAccessibleName(state: FolderItemAccessibilityState): string;
  export function applyFoldersNavigationLandmark(element: HTMLElement): void;
  export function applyFolderItemAccessibility(element: HTMLElement, state: FolderItemAccessibilityState): void;
  ```

- [ ] **Step 1: Add lang key**

In `src/lang.ts`, near `'ChatMenu'` / `'MessageMenu'`, add:

```ts
'OpenMenu': 'Open menu',
```

- [ ] **Step 2: Write the failing tests**

Append to `src/tests/voiceOverAccessibility.test.ts` (import the new symbols; mock already stubs `I18n.format`):

```ts
  it('labels folders navigation landmark and folder buttons', () => {
    const nav = document.createElement('div');
    applyFoldersNavigationLandmark(nav);
    expect(nav.getAttribute('role')).toBe('navigation');
    expect(nav.getAttribute('aria-label')).toBe('ChatList.Filter.List.Title');

    const item = document.createElement('div');
    item.innerHTML = '<span class="folders-sidebar__folder-item-icon"></span><div class="folders-sidebar__folder-item-badge">3</div>';
    applyFolderItemAccessibility(item, {
      title: 'unread',
      unreadCount: 3,
      isMuted: true,
      selected: true
    });

    expect(item.getAttribute('role')).toBe('button');
    expect(item.getAttribute('tabindex')).toBe('0');
    expect(item.getAttribute('aria-current')).toBe('true');
    expect(item.getAttribute('aria-label')).toContain('unread');
    expect(item.getAttribute('aria-label')).toContain('messages');
    expect(item.getAttribute('aria-label')).toContain('NotificationsMuted');
    expect(item.querySelector('.folders-sidebar__folder-item-icon')?.getAttribute('aria-hidden')).toBe('true');
    expect(item.querySelector('.folders-sidebar__folder-item-badge')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('omits aria-current and unread when not applicable', () => {
    const item = document.createElement('div');
    applyFolderItemAccessibility(item, {title: 'work', selected: false});
    expect(item.getAttribute('aria-label')).toBe('work');
    expect(item.hasAttribute('aria-current')).toBe(false);
  });
```

- [ ] **Step 3: Run tests — expect FAIL**

Run: `pnpm test src/tests/voiceOverAccessibility.test.ts`

Expected: FAIL — `applyFoldersNavigationLandmark` / `buildFolderAccessibleName` / `applyFolderItemAccessibility` not exported.

- [ ] **Step 4: Implement helpers**

Append to `src/helpers/accessibility.ts`:

```ts
export type FolderItemAccessibilityState = {
  title: string,
  unreadCount?: number,
  isMuted?: boolean,
  selected?: boolean
};

export function buildFolderAccessibleName(state: FolderItemAccessibilityState): string {
  const parts: string[] = [];

  if(state.title) {
    parts.push(state.title);
  }

  if(state.unreadCount && state.unreadCount > 0) {
    parts.push(I18n.format('messages', true, [state.unreadCount]));
  }

  if(state.isMuted) {
    parts.push(I18n.format('NotificationsMuted', true));
  }

  return joinAccessibleParts(parts);
}

export function applyFoldersNavigationLandmark(element: HTMLElement) {
  element.setAttribute('role', 'navigation');
  element.setAttribute('aria-label', I18n.format('ChatList.Filter.List.Title', true));
}

const FOLDER_ITEM_DECORATIVE_SELECTORS = [
  '.folders-sidebar__folder-item-icon',
  '.folders-sidebar__folder-item-animated-icon',
  '.folders-sidebar__folder-item-badge',
  '.menu-horizontal-div-item-background',
  '.tgico',
  'custom-emoji-renderer-element',
  '.badge'
];

export function applyFolderItemAccessibility(element: HTMLElement, state: FolderItemAccessibilityState) {
  element.setAttribute('role', 'button');
  element.tabIndex = 0;

  const label = buildFolderAccessibleName(state);
  if(label) {
    element.setAttribute('aria-label', label);
  } else {
    element.removeAttribute('aria-label');
  }

  if(state.selected) {
    element.setAttribute('aria-current', 'true');
  } else {
    element.removeAttribute('aria-current');
  }

  for(const selector of FOLDER_ITEM_DECORATIVE_SELECTORS) {
    element.querySelectorAll(selector).forEach(hideFromAccessibilityTree);
  }
}
```

Also export a tiny keyboard helper used by Solid wiring (same file):

```ts
export function handleFolderItemKeydown(event: KeyboardEvent, activate: () => void) {
  if(event.key !== 'Enter' && event.key !== ' ') {
    return;
  }

  event.preventDefault();
  activate();
}
```

- [ ] **Step 5: Run tests — expect PASS**

Run: `pnpm test src/tests/voiceOverAccessibility.test.ts`

Expected: PASS (all tests in file).

- [ ] **Step 6: Ready to commit (do not commit unless asked)**

Files: `src/lang.ts`, `src/helpers/accessibility.ts`, `src/tests/voiceOverAccessibility.test.ts`

Suggested message: `feat(a11y): add folder navigation accessibility helpers`

---

### Task 2: Wire horizontal `FoldersTabs`

**Files:**
- Modify: `src/components/foldersTabs.tsx`
- Test: manual + existing unit tests (helpers already covered)

**Interfaces:**
- Consumes: `applyFoldersNavigationLandmark`, `applyFolderItemAccessibility`, `handleFolderItemKeydown`, `useFolders`, `FOLDER_ID_ALL`, `I18n` / `i18n`
- Produces: accessible `#folders-tabs` (and any other `FoldersTabs` mount, including forward popup)

- [ ] **Step 1: Update `FoldersTabs` to apply a11y**

Replace / extend `src/components/foldersTabs.tsx` so that:

1. Destructure `selectedFolderId` from `useFolders()` as well as `folderItems`.
2. On `Tabs.Menu`, after mount (ref callback or `createEffect` on the menu element), call `applyFoldersNavigationLandmark(menuEl)`.
3. For each tab, compute plain title:
   - `item.id === FOLDER_ID_ALL` → `I18n.format('FilterAllChatsShort', true)` (horizontal short label; matches visible “All”)
   - else → `item.filter.title?.text?.trim() || ''` (raw filter title text is enough for the accessible name)
4. Apply item a11y in a ref or `createEffect` on the tab element:

```ts
import I18n, {i18n} from '@lib/langPack';
import {
  applyFolderItemAccessibility,
  applyFoldersNavigationLandmark,
  handleFolderItemKeydown
} from '@helpers/accessibility';
import {FOLDER_ID_ALL} from '@lib/appManagers/constants';
// ...
const {folderItems, selectedFolderId} = useFolders();

// inside Tab:
const plainTitle = () => item.id === FOLDER_ID_ALL ?
  I18n.format('FilterAllChatsShort', true) :
  (item.filter.title?.text || '').trim();

const applyA11y = (el: HTMLDivElement) => {
  applyFolderItemAccessibility(el, {
    title: plainTitle(),
    unreadCount: item.notifications?.count,
    isMuted: item.notifications?.muted,
    selected: selectedFolderId() === item.id
  });
};

// Tabs.MenuTab ref:
ref={(ref) => {
  ref.dataset.filterId = '' + item.filter.id;
  applyA11y(ref);
}}

// Keep a11y in sync when selection/unread/title change:
createEffect(() => {
  // read deps
  selectedFolderId();
  item.notifications?.count;
  item.notifications?.muted;
  plainTitle();
  const el = document.querySelector(
    `#folders-tabs [data-filter-id="${item.filter.id}"], .menu-horizontal-div [data-filter-id="${item.filter.id}"]`
  ) as HTMLElement | null;
  // Prefer storing the element from ref in a local let instead of querySelector.
});
```

Prefer a local `let tabEl: HTMLDivElement` set from `ref`, then:

```ts
createEffect(() => {
  if(!tabEl) return;
  applyFolderItemAccessibility(tabEl, {
    title: plainTitle(),
    unreadCount: item.notifications?.count,
    isMuted: !!item.notifications?.muted,
    selected: selectedFolderId() === item.id
  });
});
```

5. Landmark once on the menu:

```ts
<Tabs.Menu
  {...(props.menuProps || {})}
  ref={(el) => {
    const userRef = props.menuProps?.ref;
    if(typeof userRef === 'function') userRef(el);
    else if(userRef) (userRef as any) = el; // follow existing Ref patterns in file; if awkward, call apply in onMount via props.menuProps.ref chain only
    applyFoldersNavigationLandmark(el);
  }}
>
```

Cleaner approach: wrap the existing `menuProps.ref` — read current `foldersTabs.tsx` and compose refs without breaking `appDialogsManager` / `pickUser` ref callbacks.

6. Keyboard: on each tab element add

```ts
onKeyDown={(e: KeyboardEvent) => {
  handleFolderItemKeydown(e, () => tabEl.click());
}}
```

(`horizontalMenu` already binds click; synthesizing click reuses that path.)

Full intended shape of the tab component (illustrative — match repo style):

```tsx
const Tab = (item: typeof folderItems[0]) => {
  let tabEl: HTMLDivElement;
  const title = () => { /* existing visible title JSX */ };

  const plainTitle = () => item.id === FOLDER_ID_ALL ?
    I18n.format('FilterAllChatsShort', true) :
    (item.filter.title?.text || '').trim();

  createEffect(() => {
    if(!tabEl) return;
    applyFolderItemAccessibility(tabEl, {
      title: plainTitle(),
      unreadCount: item.notifications?.count,
      isMuted: !!item.notifications?.muted,
      selected: selectedFolderId() === item.id
    });
  });

  return (
    <Tabs.MenuTab
      ref={(ref) => {
        tabEl = ref;
        ref.dataset.filterId = '' + item.filter.id;
      }}
      // If Tabs.MenuTab does not forward onKeyDown, attach in ref:
      // ref.addEventListener('keydown', ...)
    >
      ...
    </Tabs.MenuTab>
  );
};
```

If `Tabs.MenuTab` does not accept `onKeyDown`, attach in the ref:

```ts
ref={(ref) => {
  tabEl = ref;
  ref.dataset.filterId = '' + item.filter.id;
  ref.onkeydown = (e) => handleFolderItemKeydown(e, () => ref.click());
}}
```

- [ ] **Step 2: Typecheck / lint the touched file**

Run: `pnpm exec oxlint src/components/foldersTabs.tsx` (or project lint command for that path)

Expected: no new errors.

- [ ] **Step 3: Ready to commit (do not commit unless asked)**

Suggested message: `feat(a11y): label horizontal folder tabs for VoiceOver`

---

### Task 3: Wire vertical folders sidebar

**Files:**
- Modify: `src/components/sidebarLeft/foldersSidebarContent/folderItem.tsx`
- Modify: `src/components/sidebarLeft/foldersSidebarContent/index.tsx`
- Modify: `src/components/sidebarLeft/foldersSidebarContent/render` landmark target — `#folders-sidebar` created in `renderFoldersSidebarContent`

**Interfaces:**
- Consumes: helpers from Task 1; `getFolderTitle` / `i18n('FilterAllChats')` for All Chats full title on vertical
- Produces: accessible `#folders-sidebar` items + chrome buttons

- [ ] **Step 1: Update `FolderItem`**

In `folderItem.tsx`:

1. Import helpers + `I18n` / `getElementPlainText` as needed.
2. Compute plain title string:
   - if `props.name` is an Element → `getElementPlainText(props.name as Element)` after render, **or** pass an optional `accessibleTitle?: string` prop from the parent (preferred — avoids guessing JSX).
3. Preferred API: add optional `accessibleTitle?: string` to `FolderItemProps`. Parents always pass it for folder rows; chrome buttons pass explicit labels via new optional `ariaLabel?: string` **or** reuse `accessibleTitle`.

```ts
type FolderItemProps = FolderItemPayload & {
  ref?: (el: HTMLDivElement | null) => void,
  class?: string,
  selected?: boolean,
  onClick?: () => void,
  accessibleTitle?: string // plain string for aria-label base
};
```

4. On the root `div`, keep `use:ripple` / `onClick`, and:

```tsx
createEffect(() => {
  if(!el) return;
  applyFolderItemAccessibility(el, {
    title: props.accessibleTitle || '',
    unreadCount: props.notifications?.count,
    isMuted: !!props.notifications?.muted,
    selected: !!props.selected
  });
});

// keydown
onKeyDown={(e) => {
  if(!props.onClick) return;
  handleFolderItemKeydown(e, () => props.onClick());
}}
```

Store `el` from `ref` like folders tabs.

5. Mark decorative nodes `aria-hidden` via the helper selectors (icon class / badge class already match). For `IconTsx`, ensure class `folders-sidebar__folder-item-icon` remains so the helper finds it. Animated icon already has `folders-sidebar__folder-item-animated-icon`.

- [ ] **Step 2: Update `FoldersSidebarContent` / render**

In `index.tsx`:

1. After creating / when showing content, apply landmark on the `#folders-sidebar` element. Easiest: in `renderFoldersSidebarContent`, after creating `foldersSidebar`:

```ts
applyFoldersNavigationLandmark(foldersSidebar);
```

(Always on the host element is fine even when content is gated by `<Show>`.)

2. Folder rows — pass accessible title:

```tsx
<FolderItem
  {...folderItem}
  {...getFolderTitle(folderItem.filter)}
  accessibleTitle={
    folderItem.id === /* FOLDER_ID_ALL */ ?
      I18n.format('FilterAllChats', true) :
      (folderItem.filter.title?.text || '').trim()
  }
  ...
/>
```

Import `FOLDER_ID_ALL` and `I18n`.

3. Menu button:

```tsx
<FolderItem
  ref={setMenuTarget}
  class="folders-sidebar__menu-button is-first"
  icon="menu"
  accessibleTitle={I18n.format('OpenMenu', true)}
  notifications={{count: props.allNotificationsCount(), muted: false}}
/>
```

4. Equalizer:

```tsx
<FolderItem
  class="folders-sidebar__menu-button is-last"
  icon="equalizer"
  accessibleTitle={I18n.format('ChatList.Filter.List.Title', true)}
  onClick={() => { /* existing open Chat Folders tab */ }}
/>
```

5. Add Chats floating control — add `role="button"`, `tabIndex={0}`, and keydown via `handleFolderItemKeydown` calling the same click handler. Visible label stays; set `aria-label` only if needed (visible text is enough when not overridden). Applying `role="button"` + `tabIndex={0}` is the minimum from the spec.

- [ ] **Step 3: Lint touched files**

Run: `pnpm exec oxlint src/components/sidebarLeft/foldersSidebarContent/`

Expected: clean.

- [ ] **Step 4: Re-run a11y unit tests**

Run: `pnpm test src/tests/voiceOverAccessibility.test.ts`

Expected: PASS.

- [ ] **Step 5: Ready to commit (do not commit unless asked)**

Suggested message: `feat(a11y): label vertical folders sidebar for VoiceOver`

---

### Task 4: Manual VoiceOver verification checklist

**Files:** none (verification only)

- [ ] **Step 1: Start preview**

Run: `bash scripts/start-preview.sh` (or existing dev server). Enable folders (create ≥1 folder). Toggle **Folders on the Left** on and off.

- [ ] **Step 2: Horizontal tabs**

With horizontal folders visible:

1. VoiceOver on → Show Numbers (VO + U / command per OS).
2. Confirm `#folders-tabs` region is announced as navigation “Chat Folders” (or localized).
3. Confirm each folder is a numbered button; name includes title and unread when present.
4. Confirm selected folder is current.
5. Tab / VO interact → Enter activates folder switch.

- [ ] **Step 3: Vertical sidebar**

Enable **Folders on the Left** (wide viewport):

1. Show Numbers includes Open menu, each folder, Chat Folders (equalizer), and Add Chats when visible.
2. Switching folders updates `aria-current` (spot-check with Accessibility Inspector / VO).

- [ ] **Step 4: Narrow viewport**

Resize below floating left sidebar breakpoint: vertical panel hidden; horizontal tabs remain the accessible surface.

- [ ] **Step 5: Note results for the user** (pass/fail per surface). No commit.

---

## Self-review (plan vs spec)

| Spec requirement | Task |
|---|---|
| Both horizontal + vertical | Tasks 2 + 3 |
| `navigation` + `button` (not tablist) | Task 1 helpers |
| Landmark label `ChatList.Filter.List.Title` | Task 1 + wiring |
| Label = title + unread (+ muted) | `buildFolderAccessibleName` |
| `aria-current` when selected | `applyFolderItemAccessibility` |
| Decorative icon/badge hidden | decorative selectors |
| Menu / equalizer / Add Chats named | Task 3 |
| `FoldersTabs` in pickUser/forward | Task 2 (shared component) |
| Enter/Space, no arrow roving | `handleFolderItemKeydown` |
| Vitest | Task 1 |
| Manual VO | Task 4 |
| Non-goals respected | Global Constraints |

No TBD placeholders remain; helper signatures are consistent across tasks.
