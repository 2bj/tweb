import {beforeEach, describe, expect, it, vi} from 'vitest';
import '@helpers/peerIdPolyfill';

const mocks = vi.hoisted(() => ({
  openMenu: vi.fn(),
  contextMenuOptions: undefined as any
}));

vi.mock('@helpers/dom/createContextMenu', () => ({
  default: (options: any) => {
    mocks.contextMenuOptions = options;
    return {open: mocks.openMenu};
  }
}));

vi.mock('@environment/sharedWorkerSupport', () => ({default: true}));

vi.mock('@lib/appDialogsManager', () => ({
  default: {
    filterId: 0,
    openDialogInNewTab: vi.fn(),
    toggleForumTabByPeerId: vi.fn()
  },
  findDialogListElement: (target: EventTarget) => {
    return (target as HTMLElement).closest?.('.chatlist-chat') || null;
  }
}));

vi.mock('@lib/appImManager', () => ({
  default: {toggleViewAsMessages: vi.fn()}
}));

vi.mock('@lib/apiManagerProxy', () => ({
  default: {
    getChat: vi.fn(),
    getPeer: vi.fn(),
    getCommunityDialog: vi.fn(),
    isForum: () => false,
    isBotforum: () => false
  }
}));

vi.mock('@lib/rootScope', () => ({
  default: {myId: (1 as UserId).toPeerId(false)}
}));

vi.mock('@stores/appSettings', () => ({
  useAppSettings: () => [{savedAsForum: false}]
}));

vi.mock('@components/createSubmenuTrigger', () => ({
  default: ({options}: any) => ({...options, onClick: vi.fn()})
}));

vi.mock('@components/popups', () => ({default: {createPopup: vi.fn()}}));
vi.mock('@components/popups/deleteDialog', () => ({default: vi.fn()}));
vi.mock('@components/popups/mute', () => ({default: vi.fn()}));
vi.mock('@components/popups/limit', () => ({default: vi.fn()}));
vi.mock('@components/popups/chatPreview', () => ({
  default: vi.fn(),
  chatPreviewAnchorFromDialogRow: vi.fn()
}));
vi.mock('@components/toast', () => ({toastNew: vi.fn()}));
vi.mock('@components/confirmationPopup', () => ({default: vi.fn()}));
vi.mock('@components/wrappers/getPeerTitle', () => ({default: vi.fn()}));
vi.mock('@components/chat/removeFee', () => ({openRemoveFeePopup: vi.fn()}));
vi.mock('@components/communities/leaveCommunity', () => ({
  default: vi.fn(),
  canLeaveCommunity: () => true
}));
vi.mock('@components/clearHistory', () => ({default: vi.fn()}));
vi.mock('@components/icon', () => ({
  default: () => document.createElement('span')
}));
vi.mock('@components/ripple', () => ({default: vi.fn()}));
vi.mock('@lib/langPack', () => ({
  default: {
    format: (key: string) => key
  },
  i18n: (key: string) => {
    const element = document.createElement('span');
    element.textContent = key;
    return element;
  },
  _i18n: vi.fn()
}));

import DialogsContextMenu from '@components/dialogsContextMenu';
import {
  createDialogChatMenuButton,
  shouldShowDialogChatMenu
} from '@helpers/accessibility';
import {simulateClickEvent} from '@helpers/dom/clickEvent';

describe('dialog chat menu button', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.contextMenuOptions = undefined;
  });

  it('skips rows without a dialog context menu', () => {
    expect(shouldShowDialogChatMenu({autonomous: true})).toBe(false);
    expect(shouldShowDialogChatMenu({asAllChats: 'topics'})).toBe(false);
    expect(shouldShowDialogChatMenu({autonomous: false})).toBe(true);
    expect(shouldShowDialogChatMenu({
      autonomous: true,
      withChatMenu: true
    })).toBe(true);
  });

  it('creates a voice-friendly Chat menu control on dialog rows', () => {
    const row = document.createElement('a');
    row.classList.add('chatlist-chat');
    const onOpen = vi.fn();
    const button = createDialogChatMenuButton(onOpen);
    row.append(button);

    expect(button.classList.contains('dialog-chat-menu-button')).toBe(true);
    expect(button.dataset.dialogListAction).toBe('true');
    expect(button.getAttribute('aria-label')).toBe('ChatMenu');

    simulateClickEvent(button);

    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(row.contains(button)).toBe(true);
  });

  it('opens the shared dialogs context menu from the row button', () => {
    const list = document.createElement('ul');
    const row = document.createElement('a');
    row.classList.add('chatlist-chat');
    row.dataset.peerId = '1';
    list.append(row);

    const menu = new DialogsContextMenu({} as any);
    menu.attach(list);

    const button = createDialogChatMenuButton((event) => {
      menu.openFromEvent(event);
    });
    row.append(button);

    simulateClickEvent(button);

    expect(mocks.openMenu).toHaveBeenCalledTimes(1);
    const event = mocks.openMenu.mock.calls[0][0] as MouseEvent;
    expect(mocks.contextMenuOptions.findElement(event)).toBe(row);
  });
});
