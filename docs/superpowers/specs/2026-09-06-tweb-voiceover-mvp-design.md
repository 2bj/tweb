# VoiceOver / screen-reader MVP — tweb

## Problem

With VoiceOver on macOS, Telegram Web K’s chat list, message feed, and composer exist in the DOM but lack meaningful roles and accessible names. VoiceOver Show Numbers therefore exposes few or no numbered targets in the primary chat workflow.

## Approach

Progressive ARIA on existing DOM — no UI rewrite.

1. **Chat list** — `ul.chatlist` as a list; each `.chatlist-chat` row as a list item with a concise `aria-label` (title, unread/muted summary, last-message preview, time). Active dialog gets `aria-current="true"`. Labels refresh when title/subtitle/badge state changes.
2. **Message feed** — open chat messages region; each visible bubble gets a role and accessible name (author, text/media summary, time, in/out). Media-only bubbles include a media-type label, not silence.
3. **Composer** — labeled message textbox; named send and attach controls.
4. **Landmarks** — sidebar navigation (`#chatlist-container`), chat messages region, composer region.
5. **Live region** — skipped in MVP (optional follow-up).

Implementation helper: `src/helpers/accessibility.ts`.

## Success criteria

- Chat rows, visible bubbles, and composer/send appear in the accessibility tree with useful names (verifiable in Vitest; VoiceOver Show Numbers verified manually).
- `pnpm test` passes for new and existing a11y tests (including `buttonMenuAccessibility.test.ts`).
- PR lists changed files and manual VoiceOver verification steps.

## Non-goals

- Keyboard arrow roving / roving tabindex (follow-up).
- Full info-panel landmark coverage unless trivial.
- Polite live region for new messages (follow-up if not small).
- Replacing `<a.chatlist-chat>` inside `<ul>` with `<li>` wrappers (DOM rewrite).
- Broader a11y audit outside chat list / feed / composer.
