import {beforeEach, describe, expect, it, vi} from 'vitest';

vi.mock('@components/wrappers/getPeerTitle', () => ({
  default: vi.fn()
}));

vi.mock('@lib/langPack', () => ({
  default: {
    format: (key: string, plain?: boolean) => (plain ? key : key)
  },
  i18n: (key: string) => {
    const element = document.createElement('span');
    element.textContent = key;
    return element;
  }
}));

import {
  applyChatListScrollAccessibility,
  handleChatListScrollKeydown,
  scrollChatListContainer
} from '@helpers/accessibility';

function pressKey(element: HTMLElement, key: string) {
  const event = new KeyboardEvent('keydown', {bubbles: true, cancelable: true, key});
  element.dispatchEvent(event);
  return event;
}

describe('chat list scroll accessibility', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    Object.defineProperty(container, 'clientHeight', {value: 200, configurable: true});
    Object.defineProperty(container, 'scrollHeight', {value: 1000, configurable: true});
    container.scrollTop = 100;
    document.body.append(container);
  });

  it('makes the scroll container focusable and adds named scroll controls', () => {
    const destroy = applyChatListScrollAccessibility(container);

    expect(container.tabIndex).toBe(0);

    const upButton = container.querySelector('.chatlist-scroll-control-up') as HTMLButtonElement;
    const downButton = container.querySelector('.chatlist-scroll-control-down') as HTMLButtonElement;

    expect(upButton).not.toBeNull();
    expect(downButton).not.toBeNull();
    expect(upButton.getAttribute('aria-label')).toBe('ScrollChatsUp');
    expect(downButton.getAttribute('aria-label')).toBe('ScrollChatsDown');

    destroy();

    expect(container.hasAttribute('tabindex')).toBe(false);
    expect(container.querySelector('.chatlist-scroll-controls')).toBeNull();
  });

  it('scrolls by roughly one viewport on PageUp and PageDown when focused', () => {
    applyChatListScrollAccessibility(container);
    container.focus();

    pressKey(container, 'PageDown');
    expect(container.scrollTop).toBe(300);

    pressKey(container, 'PageUp');
    expect(container.scrollTop).toBe(100);
  });

  it('jumps to the ends on Home and End when focused', () => {
    applyChatListScrollAccessibility(container);
    container.focus();

    pressKey(container, 'End');
    expect(container.scrollTop).toBe(1000);

    pressKey(container, 'Home');
    expect(container.scrollTop).toBe(0);
  });

  it('does not scroll on PageDown when a chat row inside holds focus', () => {
    applyChatListScrollAccessibility(container);

    const row = document.createElement('a');
    row.className = 'chatlist-chat row';
    row.href = '#';
    row.tabIndex = 0;
    container.append(row);
    row.focus();

    const event = pressKey(container, 'PageDown');
    expect(event.defaultPrevented).toBe(false);
    expect(container.scrollTop).toBe(100);
  });

  it('scrolls when voice-control buttons are clicked', () => {
    applyChatListScrollAccessibility(container);

    const upButton = container.querySelector('.chatlist-scroll-control-up') as HTMLButtonElement;
    const downButton = container.querySelector('.chatlist-scroll-control-down') as HTMLButtonElement;

    downButton.click();
    expect(container.scrollTop).toBe(300);

    upButton.click();
    expect(container.scrollTop).toBe(100);
  });

  it('clamps scroll position at the list bounds', () => {
    container.scrollTop = 850;

    scrollChatListContainer(container, 'down');
    expect(container.scrollTop).toBe(800);

    container.scrollTop = 50;
    scrollChatListContainer(container, 'up');
    expect(container.scrollTop).toBe(0);
  });

  it('ignores modified Page keys through the keydown helper', () => {
    container.tabIndex = 0;
    container.focus();

    const event = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'PageDown',
      ctrlKey: true
    });
    container.dispatchEvent(event);

    expect(handleChatListScrollKeydown(event, container)).toBe(false);
    expect(container.scrollTop).toBe(100);
  });
});
