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
    expect(host.contains(controls)).toBe(true);

    destroy();

    expect(container.hasAttribute('tabindex')).toBe(false);
    expect(host.querySelector('.chatlist-scroll-controls')).toBeNull();
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

    const upButton = host.querySelector('.chatlist-scroll-button-up') as HTMLButtonElement;
    const downButton = host.querySelector('.chatlist-scroll-button-down') as HTMLButtonElement;

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
