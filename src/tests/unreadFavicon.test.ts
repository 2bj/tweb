import {afterEach, describe, expect, it, vi} from 'vitest';
import {buildUnreadFaviconDataUrl, formatUnreadFaviconCount, getUnreadAppIconCount} from '@helpers/unreadFavicon';

describe('unread favicon', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('counts unmuted chats, not messages and not muted chats', () => {
    expect(getUnreadAppIconCount({unreadUnmutedCount: 3, unreadCount: 40})).toBe(3);
    expect(getUnreadAppIconCount({unreadUnmutedCount: 0, unreadCount: 12})).toBe(0);
  });

  it('caps the drawn count at 99+', () => {
    expect(formatUnreadFaviconCount(1)).toBe('1');
    expect(formatUnreadFaviconCount(99)).toBe('99');
    expect(formatUnreadFaviconCount(100)).toBe('99+');
  });

  it('returns empty string when there is nothing unread', () => {
    expect(buildUnreadFaviconDataUrl(0)).toBe('');
    expect(buildUnreadFaviconDataUrl(-1)).toBe('');
  });

  it('returns a png data url for a positive count', () => {
    const fillText = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      fillText
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,badge');

    expect(buildUnreadFaviconDataUrl(7)).toBe('data:image/png;base64,badge');
    expect(fillText).toHaveBeenCalledWith('7', expect.any(Number), expect.any(Number));
  });
});
