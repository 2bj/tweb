import {beforeEach, describe, expect, it, vi} from 'vitest';
import {ChatType} from '@components/chat/chatType';

const mocks = vi.hoisted(() => ({
  format: vi.fn((key: string) => key)
}));

vi.mock('@lib/langPack', () => ({
  default: {
    format: mocks.format
  }
}));

vi.mock('@components/icon', () => ({
  default: () => document.createElement('span')
}));

vi.mock('@helpers/dom/clickEvent', () => ({
  attachClickEvent: (element: HTMLElement, callback: (e: MouseEvent) => void) => {
    element.addEventListener('click', callback);
    return () => element.removeEventListener('click', callback);
  }
}));

import {
  appendMessageMenuButton,
  shouldShowMessageMenuButton
} from '@components/chat/messageMenuButton';

function createBubble(className = 'bubble') {
  const bubble = document.createElement('div');
  bubble.className = className;
  bubble.dataset.mid = '42';
  bubble.dataset.peerId = '1';
  return bubble;
}

describe('message menu button', () => {
  beforeEach(() => {
    mocks.format.mockClear();
  });

  it('shows the button only for regular rendered messages', () => {
    const bubble = createBubble();
    expect(shouldShowMessageMenuButton({
      chatType: ChatType.Chat,
      bubble
    })).toBe(true);

    expect(shouldShowMessageMenuButton({
      previewOnly: true,
      chatType: ChatType.Chat,
      bubble
    })).toBe(false);

    expect(shouldShowMessageMenuButton({
      chatType: ChatType.Static,
      bubble
    })).toBe(false);

    bubble.classList.add('service');
    expect(shouldShowMessageMenuButton({
      chatType: ChatType.Chat,
      bubble
    })).toBe(false);
    bubble.classList.remove('service');

    bubble.classList.add('is-date');
    expect(shouldShowMessageMenuButton({
      chatType: ChatType.Chat,
      bubble
    })).toBe(false);
    bubble.classList.remove('is-date');

    bubble.classList.add('bubble-first');
    expect(shouldShowMessageMenuButton({
      chatType: ChatType.Chat,
      bubble
    })).toBe(false);
    bubble.classList.remove('bubble-first');

    bubble.classList.add('botforum-new-topic-bubble');
    expect(shouldShowMessageMenuButton({
      chatType: ChatType.Chat,
      bubble
    })).toBe(false);
    bubble.classList.remove('botforum-new-topic-bubble');

    bubble.classList.add('is-sponsored');
    expect(shouldShowMessageMenuButton({
      chatType: ChatType.Chat,
      bubble
    })).toBe(false);
    bubble.classList.remove('is-sponsored');

    delete bubble.dataset.mid;
    expect(shouldShowMessageMenuButton({
      chatType: ChatType.Chat,
      bubble
    })).toBe(false);
  });

  it('renders an accessible button and opens the context menu on click', () => {
    const bubble = createBubble('bubble with-beside-button');
    const bubbleContainer = document.createElement('div');
    bubbleContainer.classList.add('bubble-content');
    const onOpen = vi.fn();

    appendMessageMenuButton({
      bubble,
      bubbleContainer,
      onOpen,
      listenerSetter: undefined as any
    });

    const button = bubbleContainer.querySelector<HTMLButtonElement>('.message-menu');
    expect(button).toBeTruthy();
    expect(button.type).toBe('button');
    expect(mocks.format).toHaveBeenCalledWith('MessageMenu', true);
    expect(button.getAttribute('aria-label')).toBe('MessageMenu');
    expect(button.classList.contains('bubble-beside-button--lifted')).toBe(true);

    button.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true}));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
