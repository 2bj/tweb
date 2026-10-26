import {beforeEach, describe, expect, it, vi} from 'vitest';
import '@helpers/peerIdPolyfill';

const mocks = vi.hoisted(() => ({
  wrapMessageForReply: vi.fn(),
  getPeerTitle: vi.fn()
}));

vi.mock('@components/wrappers/messageForReply', () => ({
  default: mocks.wrapMessageForReply
}));

vi.mock('@components/wrappers/getPeerTitle', () => ({
  default: mocks.getPeerTitle
}));

vi.mock('@lib/langPack', () => ({
  default: {
    format: (key: string, plain?: boolean, args?: unknown[]) => {
      if(args?.length) {
        return `${args[0]} ${key}`;
      }

      return plain ? key : key;
    }
  },
  i18n: (key: string) => {
    const element = document.createElement('span');
    element.textContent = key;
    return element;
  }
}));

vi.mock('@helpers/date', () => ({
  formatTime: (date: Date) => {
    const element = document.createElement('span');
    element.textContent = date.toISOString().slice(11, 16);
    return element;
  }
}));

import {
  applyAttachButtonAccessibility,
  applyArchiveDialogAccessibility,
  applyBubbleAccessibility,
  applyChatListAccessibility,
  applyComposerLandmark,
  applyDateBubbleAccessibility,
  applyDialogRowAccessibility,
  applyDialogRowHitTargets,
  applyFolderItemAccessibility,
  applyFoldersNavigationLandmark,
  applyInputSearchAccessibility,
  applyMessageInputAccessibility,
  applyMessagesFeedLandmark,
  applySendButtonAccessibility,
  applySidebarBackButtonAccessibility,
  applySidebarSearchTriggerAccessibility,
  applySidebarToolsButtonAccessibility,
  buildBubbleAccessibleName,
  buildDialogAccessibleName,
  countDialogRowAccessibilityTargets,
  refreshDialogRowAccessibility
} from '@helpers/accessibility';

describe('voiceOver accessibility helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.wrapMessageForReply.mockImplementation(async({message}) => {
      return message._ === 'messageService' ? 'Joined the group' : message.message;
    });
    mocks.getPeerTitle.mockResolvedValue('Alice');
  });

  const createChatlistRow = (innerHTML: string, extraClass = '') => {
    const row = document.createElement('div');
    row.className = ['chatlist-chat', 'row', extraClass].filter(Boolean).join(' ');
    row.dataset.peerId = '1';
    row.innerHTML = innerHTML;
    return row;
  };

  const dialogChatLink = (row: HTMLElement) => {
    return row.querySelector('.dialog-chat-link') as HTMLAnchorElement | null;
  };

  it('builds concise dialog accessible names with unread and muted state', () => {
    expect(buildDialogAccessibleName({
      title: 'Telegram',
      subtitle: 'Hello there',
      time: '3:45 PM',
      unreadCount: '3',
      isMuted: true,
      isActive: true
    })).toContain('Telegram');
    expect(buildDialogAccessibleName({
      title: 'Telegram',
      subtitle: 'Hello there',
      time: '3:45 PM',
      unreadCount: '3',
      isMuted: true,
      isActive: true
    })).toContain('messages');
    expect(buildDialogAccessibleName({
      title: 'Telegram',
      subtitle: 'Hello there',
      time: '3:45 PM',
      unreadCount: '3',
      isMuted: true,
      isActive: true
    })).toContain('NotificationsMuted');
  });

  it('marks chat lists and dialog rows with list semantics and aria-current', () => {
    const list = document.createElement('ul');
    const row = createChatlistRow(`
      <span class="peer-title">Bob</span>
      <div class="dialog-subtitle"><span class="dialog-subtitle-span">See you soon</span></div>
      <span class="message-time">4:20 PM</span>
    `);
    list.append(row);

    applyChatListAccessibility(list);
    applyDialogRowAccessibility(row, {
      title: 'Bob',
      subtitle: 'See you soon',
      time: '4:20 PM',
      isActive: true
    });

    const link = dialogChatLink(row);
    expect(list.getAttribute('role')).toBe('list');
    expect(row.getAttribute('role')).toBe('listitem');
    expect(row.getAttribute('aria-current')).toBe('true');
    expect(link).not.toBeNull();
    expect(link.href).toContain('#1');
    expect(link.querySelector('.dialog-a11y-label')?.textContent).toContain('Bob');
    expect(link.querySelector('.dialog-a11y-label')?.textContent).toContain('See you soon');
  });

  it('marks virtual chatlists from SortedDialogList with role=list (regression)', () => {
    const list = document.createElement('ul');
    list.classList.add('chatlist', 'virtual-chatlist');

    applyChatListAccessibility(list);

    expect(list.classList.contains('virtual-chatlist')).toBe(true);
    expect(list.getAttribute('role')).toBe('list');
  });

  it('refreshes recycled dialog rows from the live DOM', () => {
    const row = createChatlistRow(`
      <span class="peer-title">Updated title</span>
      <div class="dialog-subtitle"><span class="dialog-subtitle-span">Draft: hello</span></div>
      <span class="message-time">Now</span>
      <div class="dialog-subtitle-badge badge dialog-subtitle-badge-unread is-visible mention">@</div>
    `, 'active is-muted');

    refreshDialogRowAccessibility(row);

    const link = dialogChatLink(row);
    expect(row.getAttribute('aria-current')).toBe('true');
    expect(link.querySelector('.dialog-a11y-label')?.textContent).toContain('Updated title');
    expect(link.querySelector('.dialog-a11y-label')?.textContent).toContain('Mention');
  });

  it('names message bubbles including media-only content and direction', async() => {
    const message = {
      _: 'message',
      pFlags: {},
      peerId: 1 as PeerId,
      fromId: 2 as PeerId,
      mid: 1,
      date: 1_700_000_000,
      message: '',
      media: {
        _: 'messageMediaPhoto',
        photo: {
          _: 'photo',
          id: '1',
          access_hash: '1',
          date: 1,
          dc_id: 1,
          sizes: []
        }
      }
    } as any;

    mocks.wrapMessageForReply.mockResolvedValueOnce('AttachPhoto');

    const label = await buildBubbleAccessibleName({
      message,
      isOutgoing: false
    });

    expect(label).toContain('Alice');
    expect(label).toContain('AttachPhoto');
    expect(label).toContain('received');
  });

  it('applies article semantics and labels to rendered bubbles', async() => {
    const bubble = document.createElement('div');
    const message = {
      _: 'message',
      pFlags: {out: true},
      peerId: 1 as PeerId,
      fromId: 1 as PeerId,
      mid: 2,
      date: 1_700_000_000,
      message: 'On my way'
    } as any;

    mocks.wrapMessageForReply.mockResolvedValueOnce('On my way');

    await applyBubbleAccessibility({
      bubble,
      message,
      isOutgoing: true
    });

    expect(bubble.getAttribute('role')).toBe('article');
    expect(bubble.getAttribute('aria-label')).toContain('FromYou');
    expect(bubble.getAttribute('aria-label')).toContain('On my way');
    expect(bubble.getAttribute('aria-label')).toContain('sent');
  });

  it('labels composer controls and message/date landmarks', () => {
    const feed = document.createElement('div');
    const composer = document.createElement('div');
    const input = document.createElement('div');
    input.contentEditable = 'true';
    const send = document.createElement('button');
    const attach = document.createElement('attach-menu-button');

    applyMessagesFeedLandmark(feed, 'Alice, Messages');
    applyComposerLandmark(composer);
    applyMessageInputAccessibility(input);
    applySendButtonAccessibility(send);
    applyAttachButtonAccessibility(attach);

    expect(feed.getAttribute('role')).toBe('region');
    expect(feed.getAttribute('aria-label')).toBe('Alice, Messages');
    expect(composer.getAttribute('role')).toBe('region');
    expect(composer.getAttribute('aria-label')).toBe('SendMessageTitle');
    expect(input.getAttribute('role')).toBe('textbox');
    expect(input.getAttribute('aria-label')).toBe('Message');
    expect(send.getAttribute('aria-label')).toBe('Send');
    expect(attach.getAttribute('aria-label')).toBe('Attach');
    expect(attach.getAttribute('role')).toBe('button');
    expect(attach.tabIndex).toBe(0);
  });

  it('keeps native button semantics when the attach control is already a button', () => {
    const attach = document.createElement('button');
    applyAttachButtonAccessibility(attach);

    expect(attach.getAttribute('aria-label')).toBe('Attach');
    expect(attach.getAttribute('role')).toBeNull();
  });

  it('labels date bubbles as headings', () => {
    const bubble = document.createElement('div');
    bubble.className = 'bubble service is-date';
    bubble.innerHTML = '<div class="bubble-content"><div class="service-msg">Date.Today</div></div>';

    applyDateBubbleAccessibility(bubble);

    expect(bubble.getAttribute('role')).toBe('heading');
    expect(bubble.getAttribute('aria-level')).toBe('2');
    expect(bubble.getAttribute('aria-label')).toBe('Date.Today');
  });

  it('exposes one accessibility target on dialog rows without stories', () => {
    const row = createChatlistRow(`
      <div class="row-media dialog-avatar">
        <div class="avatar avatar-like avatar-54" data-peer-id="1"></div>
      </div>
      <div class="row-row row-title-row dialog-title">
        <div class="row-title user-title"><span class="peer-title">Alice</span></div>
        <div class="row-title-right dialog-title-details">
          <span class="message-status"></span>
          <span class="message-time">4:20 PM</span>
        </div>
      </div>
      <div class="row-row row-subtitle-row dialog-subtitle">
        <div class="row-subtitle"><span class="dialog-subtitle-span">See you soon</span></div>
        <div class="dialog-subtitle-badge badge dialog-subtitle-badge-unread is-visible">3</div>
      </div>
    `);

    applyDialogRowAccessibility(row, {
      title: 'Alice',
      subtitle: 'See you soon',
      time: '4:20 PM',
      unreadCount: '3'
    });

    expect(countDialogRowAccessibilityTargets(row)).toBe(1);
    expect(dialogChatLink(row)).not.toBeNull();
    expect(row.querySelector('.row-title-row')?.getAttribute('aria-hidden')).toBeNull();
    expect(row.querySelector('.row-title-row .row-title')?.getAttribute('aria-hidden')).toBe('true');
    expect(row.querySelector('.row-subtitle-row')?.getAttribute('aria-hidden')).toBe('true');
    expect(row.querySelector('.dialog-avatar')?.getAttribute('aria-hidden')).toBe('true');
    expect(row.querySelector('.dialog-stories-button')).toBeNull();
  });

  it('exposes chat row and stories button when the peer has stories', () => {
    const row = createChatlistRow(`
      <div class="row-media dialog-avatar">
        <canvas class="avatar-stories-svg"></canvas>
        <div class="avatar avatar-like avatar-54 has-stories" data-peer-id="1"></div>
      </div>
      <div class="row-row row-title-row dialog-title">
        <div class="row-title user-title"><span class="peer-title">Bob</span></div>
        <div class="row-title-right dialog-title-details">
          <span class="message-time">Now</span>
        </div>
      </div>
      <div class="row-row row-subtitle-row dialog-subtitle">
        <div class="row-subtitle"><span class="dialog-subtitle-span">New story</span></div>
      </div>
    `);

    applyDialogRowAccessibility(row, {
      title: 'Bob',
      subtitle: 'New story',
      time: 'Now'
    });

    const storiesButton = row.querySelector('.dialog-stories-button') as HTMLButtonElement;
    const link = dialogChatLink(row);

    expect(countDialogRowAccessibilityTargets(row)).toBe(2);
    expect(link).not.toBeNull();
    expect(link.href).toContain('#1');
    expect(storiesButton).not.toBeNull();
    expect(storiesButton.type).toBe('button');
    expect(storiesButton.getAttribute('aria-label')).toBe('Stories');
    expect(storiesButton.dataset.dialogListAction).toBe('stories');
    expect(row.contains(storiesButton) && !link.contains(storiesButton)).toBe(true);
    expect(row.querySelector('.avatar.has-stories')?.getAttribute('aria-hidden')).toBe('true');
    expect(row.querySelector('.avatar-stories-svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('drops the stories button when stories disappear from a recycled row', () => {
    const row = createChatlistRow(`
      <div class="row-media dialog-avatar">
        <div class="avatar avatar-like avatar-54 has-stories" data-peer-id="1"></div>
      </div>
      <div class="row-row row-title-row dialog-title">
        <div class="row-title user-title"><span class="peer-title">Bob</span></div>
      </div>
      <div class="row-row row-subtitle-row dialog-subtitle">
        <div class="row-subtitle"><span class="dialog-subtitle-span">Draft</span></div>
      </div>
    `);

    applyDialogRowAccessibility(row, {title: 'Bob', subtitle: 'Draft'});
    expect(row.querySelector('.dialog-stories-button')).not.toBeNull();
    expect(countDialogRowAccessibilityTargets(row)).toBe(2);

    row.querySelector('.avatar')?.classList.remove('has-stories');
    applyDialogRowHitTargets(row);

    expect(row.querySelector('.dialog-stories-button')).toBeNull();
    expect(countDialogRowAccessibilityTargets(row)).toBe(1);
    expect(row.querySelector('.dialog-avatar')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('labels folders navigation landmark and folder buttons', () => {
    const nav = document.createElement('div');
    applyFoldersNavigationLandmark(nav);
    expect(nav.getAttribute('role')).toBe('navigation');
    expect(nav.getAttribute('aria-label')).toBe('ChatList.Filter.List.Title');

    const item = document.createElement('div');
    item.innerHTML = '<span class="folders-sidebar__folder-item-icon"></span><div class="folders-sidebar__folder-item-badge">3</div>';
    applyFolderItemAccessibility(item, {
      title: 'unread',
      unreadCount: 3,
      isMuted: true,
      selected: true
    });

    expect(item.getAttribute('role')).toBe('button');
    expect(item.getAttribute('tabindex')).toBe('0');
    expect(item.getAttribute('aria-current')).toBe('true');
    expect(item.getAttribute('aria-label')).toContain('unread');
    expect(item.getAttribute('aria-label')).toContain('messages');
    expect(item.getAttribute('aria-label')).toContain('NotificationsMuted');
    expect(item.querySelector('.folders-sidebar__folder-item-icon')?.getAttribute('aria-hidden')).toBe('true');
    expect(item.querySelector('.folders-sidebar__folder-item-badge')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('omits aria-current and unread when not applicable', () => {
    const item = document.createElement('div');
    applyFolderItemAccessibility(item, {title: 'work', selected: false});
    expect(item.getAttribute('aria-label')).toBe('work');
    expect(item.hasAttribute('aria-current')).toBe(false);
  });

  it('labels sidebar header controls for Voice Control', () => {
    const back = document.createElement('div');
    back.className = 'btn-icon sidebar-back-button';
    applySidebarBackButtonAccessibility(back);
    expect(back.getAttribute('aria-label')).toBe('SidebarBack');
    expect(back.getAttribute('role')).toBe('button');
    expect(back.tabIndex).toBe(0);

    const tools = document.createElement('div');
    tools.className = 'btn-menu-toggle sidebar-tools-button';
    applySidebarToolsButtonAccessibility(tools);
    expect(tools.getAttribute('aria-label')).toBe('SidebarMenu');
    expect(tools.getAttribute('role')).toBe('button');

    const searchTrigger = document.createElement('div');
    searchTrigger.className = 'sidebar-header-search-trigger';
    applySidebarSearchTriggerAccessibility(searchTrigger);
    expect(searchTrigger.getAttribute('aria-label')).toBe('Search');

    const inputSearch = {
      input: document.createElement('input'),
      clearBtn: document.createElement('button'),
      searchIcon: document.createElement('span')
    };
    applyInputSearchAccessibility(inputSearch);
    expect(inputSearch.input.getAttribute('aria-label')).toBe('Search');
    expect(inputSearch.clearBtn.getAttribute('aria-label')).toBe('ClearButton');
    expect(inputSearch.searchIcon.getAttribute('aria-hidden')).toBe('true');
  });

  it('names the archive row for VoiceOver and Voice Control', () => {
    const archive = document.createElement('archive-dialog');
    archive.className = 'chatlist-chat row';
    archive.innerHTML = `
      <div class="row-media"></div>
      <div class="row-row row-title-row"><span>Archived Chats</span></div>
      <div class="row-row row-subtitle-row"><div class="Subtitle">Alice, Bob</div></div>
    `;

    applyArchiveDialogAccessibility(archive, {
      title: 'ArchivedChats',
      subtitle: 'Alice, Bob',
      unreadCount: '2'
    });

    const link = dialogChatLink(archive);

    expect(archive.getAttribute('role')).toBe('listitem');
    expect(link).not.toBeNull();
    expect(link.querySelector('.dialog-a11y-label')?.textContent).toContain('ArchivedChats');
    expect(link.querySelector('.dialog-a11y-label')?.textContent).toContain('Alice, Bob');
    expect(link.querySelector('.dialog-a11y-label')?.textContent).toContain('messages');
    expect(archive.tabIndex).toBe(0);
    expect(archive.querySelector('.row-title-row')?.getAttribute('aria-hidden')).toBe('true');
  });
});
