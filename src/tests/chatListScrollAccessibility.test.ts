import {beforeEach, describe, expect, it, vi} from 'vitest';

vi.mock('@components/wrappers/getPeerTitle', () => ({
  default: vi.fn()
}));

vi.mock('@components/icon', () => ({
  default: (icon: string) => {
    const span = document.createElement('span');
    span.className = 'tgico';
    span.dataset.icon = icon;
    return span;
  }
}));

vi.mock('@components/ripple', () => ({
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
  relocateChatListScrollControls,
  scrollChatListContainer
} from '@helpers/accessibility';

function pressKey(element: HTMLElement, key: string) {
  const event = new KeyboardEvent('keydown', {bubbles: true, cancelable: true, key});
  element.dispatchEvent(event);
  return event;
}

describe('chat list scroll accessibility', () => {
  let container: HTMLDivElement;
  let host: HTMLDivElement;

  beforeEach(() => {
    host = document.createElement('div');
    host.className = 'folders-container';

    container = document.createElement('div');
    container.className = 'folders-scrollable active';
    Object.defineProperty(container, 'clientHeight', {value: 200, configurable: true});
    Object.defineProperty(container, 'scrollHeight', {value: 1000, configurable: true});
    container.scrollTop = 100;

    host.append(container);
    document.body.append(host);
  });

  it('makes the scroll container focusable and adds visible named scroll controls', () => {
    host.id = 'folders-container';
    const destroy = applyChatListScrollAccessibility(container);

    expect(container.tabIndex).toBe(0);

    const controls = host.querySelector('.chatlist-scroll-controls');
    const upButton = host.querySelector('.chatlist-scroll-button-up') as HTMLButtonElement;
    const downButton = host.querySelector('.chatlist-scroll-button-down') as HTMLButtonElement;

    expect(controls).not.toBeNull();
    expect(controls?.getAttribute('aria-hidden')).toBeNull();
    expect(upButton).not.toBeNull();
    expect(downButton).not.toBeNull();
    expect(upButton.getAttribute('aria-hidden')).toBeNull();
    expect(downButton.getAttribute('aria-hidden')).toBeNull();
    expect(upButton.getAttribute('aria-label')).toBe('ScrollChatsUp');
    expect(downButton.getAttribute('aria-label')).toBe('ScrollChatsDown');
    expect(upButton.classList.contains('btn-circle')).toBe(true);
    expect(upButton.classList.contains('chatlist-scroll-control')).toBe(false);
    expect(downButton.classList.contains('chatlist-scroll-control')).toBe(false);
    expect(upButton.querySelector('[data-icon="arrow_up"]')).not.toBeNull();
    expect(downButton.querySelector('[data-icon="arrow_down"]')).not.toBeNull();
    expect(container.contains(controls)).toBe(false);
    expect(container.nextElementSibling).toBe(controls);
    expect(host.contains(controls)).toBe(true);
    expect(controls?.children.length).toBe(2);
    expect(controls?.firstElementChild?.classList.contains('chatlist-scroll-button-up')).toBe(true);
    expect(controls?.lastElementChild?.classList.contains('chatlist-scroll-button-down')).toBe(true);

    destroy();

    expect(container.hasAttribute('tabindex')).toBe(false);
    expect(host.querySelector('.chatlist-scroll-controls')).toBeNull();
  });

  it('relocates scroll controls beside the folder after a deferred mount', async() => {
    host.id = 'folders-container';
    container.remove();

    const destroy = applyChatListScrollAccessibility(container);
    expect(container.querySelector('.chatlist-scroll-controls')).not.toBeNull();
    expect(container.nextElementSibling?.classList.contains('chatlist-scroll-controls') ?? false).toBe(false);

    host.append(container);

    await Promise.resolve();

    const controls = host.querySelector('.chatlist-scroll-controls');
    expect(controls).not.toBeNull();
    expect(container.contains(controls)).toBe(false);
    expect(container.nextElementSibling).toBe(controls);

    destroy();
  });

  it('mounts each folder controls as the immediate next sibling inside folders-container', async() => {
    host.id = 'folders-container';

    const inactiveContainer = document.createElement('div');
    inactiveContainer.className = 'folders-scrollable';
    host.prepend(inactiveContainer);

    applyChatListScrollAccessibility(inactiveContainer);

    const detachedContainer = document.createElement('div');
    detachedContainer.className = 'folders-scrollable active';
    applyChatListScrollAccessibility(detachedContainer);
    host.append(detachedContainer);

    await Promise.resolve();

    const inactiveControls = inactiveContainer.nextElementSibling as HTMLElement;
    const activeControls = detachedContainer.nextElementSibling as HTMLElement;

    expect(inactiveControls?.classList.contains('chatlist-scroll-controls')).toBe(true);
    expect(activeControls?.classList.contains('chatlist-scroll-controls')).toBe(true);
    expect(inactiveControls?.previousElementSibling).toBe(inactiveContainer);
    expect(activeControls?.previousElementSibling).toBe(detachedContainer);
    expect(inactiveContainer.contains(inactiveControls)).toBe(false);
    expect(detachedContainer.contains(activeControls)).toBe(false);
  });

  it('keeps controls beside their folder after the folder is reordered', () => {
    host.id = 'folders-container';

    const folderA = document.createElement('div');
    folderA.className = 'folders-scrollable';
    const folderB = document.createElement('div');
    folderB.className = 'folders-scrollable active';

    host.append(folderA, folderB);
    applyChatListScrollAccessibility(folderA);
    applyChatListScrollAccessibility(folderB);

    const controlsA = folderA.nextElementSibling as HTMLElement;
    const controlsB = folderB.nextElementSibling as HTMLElement;

    host.insertBefore(folderB, folderA);
    relocateChatListScrollControls(folderA);
    relocateChatListScrollControls(folderB);

    expect(folderA.nextElementSibling).toBe(controlsA);
    expect(folderB.nextElementSibling).toBe(controlsB);
  });

  it('scrolls by half the viewport on PageUp and PageDown when focused', () => {
    applyChatListScrollAccessibility(container);
    container.focus();

    pressKey(container, 'PageDown');
    expect(container.scrollTop).toBe(200);

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

    const upButton = host.querySelector('.chatlist-scroll-button-up') as HTMLButtonElement;
    const downButton = host.querySelector('.chatlist-scroll-button-down') as HTMLButtonElement;

    downButton.click();
    expect(container.scrollTop).toBe(200);

    upButton.click();
    expect(container.scrollTop).toBe(100);
  });

  it('scrolls by half the viewport through scrollChatListContainer', () => {
    scrollChatListContainer(container, 'down');
    expect(container.scrollTop).toBe(200);

    scrollChatListContainer(container, 'up');
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
