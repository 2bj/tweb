import {describe, expect, test, vi} from 'vitest';
import {customEmojiRenderLoopNeedsTick} from '@lib/customEmoji/renderLoop';

describe('customEmojiRenderLoopNeedsTick', () => {
  test('returns false when every synced player is paused', () => {
    const renderer = {
      isConnected: true,
      ignoreSettingDimensions: false,
      checkForAnyFrame: () => true,
      playersSynced: new Map([
        ['a', {paused: true}],
        ['b', {paused: true}]
      ])
    };

    expect(customEmojiRenderLoopNeedsTick([renderer as any])).toBe(false);
  });

  test('returns true when at least one player is playing', () => {
    const renderer = {
      isConnected: true,
      ignoreSettingDimensions: false,
      checkForAnyFrame: () => true,
      playersSynced: new Map([
        ['a', {paused: true}],
        ['b', {paused: false}]
      ])
    };

    expect(customEmojiRenderLoopNeedsTick([renderer as any])).toBe(true);
  });

  test('returns false while the document is hidden', () => {
    Object.defineProperty(document, 'hidden', {configurable: true, value: true});
    const renderer = {
      isConnected: true,
      ignoreSettingDimensions: false,
      checkForAnyFrame: () => true,
      playersSynced: new Map([['a', {paused: false}]])
    };

    expect(customEmojiRenderLoopNeedsTick([renderer as any])).toBe(false);
    Object.defineProperty(document, 'hidden', {configurable: true, value: false});
  });
});
