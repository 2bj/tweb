import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

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
  handlePairedColumnScrollEvent,
  handlePairedColumnWheelEvent,
  relocateChatListScrollControls,
  rememberPairedColumnScrollPositions,
  scrollChatListContainer,
  scrollSyncedColumns
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

  afterEach(() => {
    host.remove();
  });

  it('adds named scroll controls without exposing them in the accessibility tree as hidden', () => {
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
    expect(upButton.classList.contains('btn-circle')).toBe(false);
    expect(upButton.classList.contains('chatlist-scroll-control')).toBe(false);
    expect(downButton.classList.contains('chatlist-scroll-control')).toBe(false);
    expect(upButton.querySelector('.c-ripple')).toBeNull();
    expect(downButton.querySelector('.c-ripple')).toBeNull();
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

  describe('synced with the open chat', () => {
    let messages: HTMLDivElement;
    let column: HTMLDivElement;

    beforeEach(() => {
      host.id = 'folders-container';

      column = document.createElement('div');
      column.id = 'column-center';

      const chat = document.createElement('div');
      chat.className = 'chat active';

      messages = document.createElement('div');
      messages.className = 'scrollable bubbles-scrollable';
      Object.defineProperty(messages, 'clientHeight', {value: 400, configurable: true});
      Object.defineProperty(messages, 'scrollHeight', {value: 2000, configurable: true});
      messages.scrollTop = 200;

      chat.append(messages);
      column.append(chat);
      document.body.append(column);
    });

    afterEach(() => {
      column.remove();
    });

    it('scrolls the chat list and the message feed together on Scroll down and Scroll up', () => {
      applyChatListScrollAccessibility(container);

      const downButton = host.querySelector('.chatlist-scroll-button-down') as HTMLButtonElement;
      const upButton = host.querySelector('.chatlist-scroll-button-up') as HTMLButtonElement;

      downButton.click();
      expect(container.scrollTop).toBe(200);
      expect(messages.scrollTop).toBe(400);

      upButton.click();
      expect(container.scrollTop).toBe(100);
      expect(messages.scrollTop).toBe(200);
    });

    it('keeps Home and End on the chat list only', () => {
      applyChatListScrollAccessibility(container);
      container.focus();

      pressKey(container, 'End');
      expect(container.scrollTop).toBe(1000);
      expect(messages.scrollTop).toBe(200);
    });

    it('scrolls both columns through scrollSyncedColumns', () => {
      scrollSyncedColumns(container, 'down');
      expect(container.scrollTop).toBe(200);
      expect(messages.scrollTop).toBe(400);
    });

    it('moves the chat list when Voice Control pages the open chat', () => {
      applyChatListScrollAccessibility(container);
      rememberPairedColumnScrollPositions();

      messages.scrollTop = 500;
      handlePairedColumnScrollEvent({target: messages} as unknown as Event);

      expect(container.scrollTop).toBe(200);
      expect(messages.scrollTop).toBe(500);
    });

    it('ignores jumping to the bottom of a newly opened chat', () => {
      applyChatListScrollAccessibility(container);
      rememberPairedColumnScrollPositions();

      messages.scrollTop = 1800;
      handlePairedColumnScrollEvent({target: messages} as unknown as Event);

      expect(container.scrollTop).toBe(100);
    });

    it('moves the chat list when the open chat gets a page-sized wheel', () => {
      applyChatListScrollAccessibility(container);
      rememberPairedColumnScrollPositions();

      const event = new WheelEvent('wheel', {deltaY: 400, deltaMode: WheelEvent.DOM_DELTA_PIXEL});
      Object.defineProperty(event, 'currentTarget', {value: messages});
      handlePairedColumnWheelEvent(event);

      expect(container.scrollTop).toBe(200);
    });

    it('ignores small chat scrolls so a wheel tick does not move the list', () => {
      applyChatListScrollAccessibility(container);
      rememberPairedColumnScrollPositions();

      messages.scrollTop = 220;
      handlePairedColumnScrollEvent({target: messages} as unknown as Event);

      expect(container.scrollTop).toBe(100);
    });
  });
});

describe('folder tabs regression', () => {
  function mountFolderPanel(container: HTMLElement, label: string) {
    const panel = document.createElement('div');
    panel.className = 'tabs-tab folders-scrollable scrollable';

    const top = document.createElement('div');
    top.className = 'chatlist-top';

    const list = document.createElement('ul');
    list.className = 'chatlist virtual-chatlist';
    list.textContent = label;

    top.append(list);
    panel.append(top);
    container.append(panel);
    applyChatListScrollAccessibility(panel);

    return panel;
  }

  it('resolves custom folder panels when scroll controls sit between tab panels', async() => {
    const {getTabPanelByIndex} = await import('@helpers/dom/tabPanels');
    const foldersContainer = document.createElement('div');
    foldersContainer.id = 'folders-container';
    document.body.append(foldersContainer);

    mountFolderPanel(foldersContainer, 'All chats');
    mountFolderPanel(foldersContainer, 'Work chats');

    const workPanel = getTabPanelByIndex(foldersContainer, 1);
    expect(workPanel.classList.contains('tabs-tab')).toBe(true);
    expect(workPanel.querySelector('.virtual-chatlist')?.textContent).toBe('Work chats');
    expect(foldersContainer.children[1].classList.contains('chatlist-scroll-controls')).toBe(true);
  });

  it('mounts scroll controls as siblings after the folder panel is attached', () => {
    const panel = document.createElement('div');
    panel.className = 'tabs-tab folders-scrollable scrollable';

    const host = document.createElement('div');
    host.id = 'folders-container';
    host.append(panel);

    const destroy = applyChatListScrollAccessibility(panel);
    expect(host.querySelectorAll('.tabs-tab').length).toBe(1);
    expect(host.querySelectorAll('.chatlist-scroll-controls').length).toBe(1);
    expect(host.children[0]).toBe(panel);
    expect(host.children[1]?.classList.contains('chatlist-scroll-controls')).toBe(true);
    destroy();
  });
});
