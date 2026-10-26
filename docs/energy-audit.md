# Safari / idle energy audit (tweb fork)

Audit date: 2026-10-26. Method: static analysis of animation timers, loops, and visibility handling; Vitest for changed logic. Chromium headless would not reproduce Safari main-thread Lottie (this fork disables offscreen Lottie on Safari).

## Ranked idle consumers (tab visible, chat or list open, little or no input)

| Rank | Subsystem | Evidence | Typical frequency | Notes |
|------|-----------|----------|-------------------|-------|
| 1 | **Looping Lottie stickers / reactions in viewport** | `src/lib/lottie/lottiePlayer.ts` (`frameListener`, `engageFreeRun`), registered via `src/components/animationIntersector.ts` | Up to sticker FPS (often 30–60) per visible player | Safari renders on the **main thread** (`src/lib/lottie/shouldRenderOffscreen.ts` excludes Safari). Largest sustained CPU when a chat shows many animated stickers/emojis. |
| 2 | **Custom emoji compositor tick** | `src/lib/customEmoji/renderer.ts` — `setInterval(renderEmojis, CUSTOM_EMOJI_FRAME_INTERVAL)` where interval = **~16 ms (60 Hz)** | 60 Hz whenever renderers exist | Previously kept running even if **all** synced players were paused (interval never cleared). |
| 3 | **“Focused but inactive” window** | `src/helpers/idleController.ts` (before fix): idle only on `blur`, not after input silence | Animations run indefinitely after first `mousemove` while window stays focused | Hurts Voice Control / VoiceOver users who do not move the pointer. `animationIntersector` only pauses autoplay when `idleController.isIdle`. |
| 4 | **Lottie worker free-run clocks (background tab)** | `src/lib/lottie/lottieLoader.ts` → `lottieMessagePort.suspendAllTabPlayers` | Worker timers (not throttled like tab timers) | Was wired only for offscreen canvas builds; workers still run on Safari. |
| 5 | **WebGL / canvas spoilers (bluff dots)** | `src/components/dotRenderer.ts`, `animationIntersector` type `dots` | rAF while visible & playing | Usually tied to intersector + idle; lower impact than chat stickers unless many spoilers on screen. |
| 6 | **Animated chat background (gradient)** | `src/components/chat/gradientRenderer.ts` | rAF only during `toNextPosition` transitions (scroll/theme), not a permanent loop | Static gradient between transitions. gated by lite mode `chat_background`. |
| 7 | **CSS loops (typing, shimmer, spinners)** | e.g. `src/scss/partials/_peerTyping.scss`, `_shimmer.scss` | While UI state shows typing / loading | Only when those states are active, not generic idle chat. |
| 8 | **MTProto / status timers** | `src/lib/uiNotificationsManager.ts` (title 1 Hz), `appImManager` status 50 s, `appUsersManager` 60 s | Low | Not animation-scale; negligible vs Lottie. |

## Accessibility work (this fork)

`src/helpers/accessibility.ts` and dialog/bubble aria updates are **event-driven** (render / refresh hooks), not per-frame loops. No evidence of MutationObserver-driven hot loops on the chat list.

## Unknown without real Safari + VoiceOver

- Exact Safari “significant energy” threshold and whether it weights main-thread canvas vs workers differently.
- Whether macOS Voice Control synthesizes events that reset idle timers (keydown/pointer listeners were added to be safe).
- GPU cost of large backdrop blurs and themed wallpapers at Retina DPR.

## Fixes in this PR

1. **`idleController`**: `document.visibilitychange` → idle when hidden; **90 s inactivity** while focused pauses animations; wake on keyboard/pointer/wheel/touch (not pointer-only).
2. **`customEmojiRenderLoopNeedsTick`**: stop 60 Hz interval when all players paused or tab hidden; resume on visibility when needed.
3. **`lottieLoader`**: suspend worker free-run on hidden tab for **all** builds (not only offscreen canvas).
4. **`animationIntersector`**: honor **`prefers-reduced-motion: reduce`** for autoplay.

## Measurement (Vitest proxy)

Before logic change, `customEmojiRenderLoopNeedsTick` would still return `true` with all players paused if renderers were connected (interval kept firing). After: returns `false` → interval clears (see `src/tests/customEmojiRenderLoop.test.ts`).

Idle: `src/tests/idleController.test.ts` — focused window becomes idle after `INACTIVITY_IDLE_MS` without input.

Full idle CPU % on Safari must be validated on the user’s machine (Activity Monitor / Web Inspector timelines).

## Settings users can enable today

**Settings → Power saving / Lite mode** (`liteMode` in app settings):

- **`all`** — disables most animations/media at once.
- **`stickers_chat`** — static stickers in chats.
- **`chat_background`** — animated/theme backgrounds.
- **`emoji` / `emoji_messages`** — animated custom emoji in messages.
- **`effects_reactions`** — reaction effects.

Enable **`all`** or granular keys for maximum idle savings without code changes.
