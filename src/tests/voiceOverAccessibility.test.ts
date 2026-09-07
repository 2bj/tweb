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
  applyBubbleAccessibility,
  applyChatListAccessibility,
  applyComposerLandmark,
  applyDateBubbleAccessibility,
  applyDialogRowAccessibility,
  applyDialogRowHitTargets,
  applyFolderItemAccessibility,
  applyFoldersNavigationLandmark,
  applyMessageInputAccessibility,
  applyMessagesFeedLandmark,
  applySendButtonAccessibility,
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
    const row = document.createElement('a');
    row.className = 'chatlist-chat row';
    row.innerHTML = `
      <span class="peer-title">Bob</span>
      <div class="dialog-subtitle"><span class="dialog-subtitle-span">See you soon</span></div>
      <span class="message-time">4:20 PM</span>
    `;
    list.append(row);

    applyChatListAccessibility(list);
    applyDialogRowAccessibility(row, {
      title: 'Bob',
      subtitle: 'See you soon',
      time: '4:20 PM',
      isActive: true
    });

    expect(list.getAttribute('role')).toBe('list');
    expect(row.getAttribute('role')).toBe('listitem');
    expect(row.getAttribute('aria-current')).toBe('true');
    expect(row.getAttribute('aria-label')).toContain('Bob');
    expect(row.getAttribute('aria-label')).toContain('See you soon');
  });

  it('marks virtual chatlists from SortedDialogList with role=list (regression)', () => {
    const list = document.createElement('ul');
    list.classList.add('chatlist', 'virtual-chatlist');

    applyChatListAccessibility(list);

    expect(list.classList.contains('virtual-chatlist')).toBe(true);
    expect(list.getAttribute('role')).toBe('list');
  });

  it('refreshes recycled dialog rows from the live DOM', () => {
    const row = document.createElement('a');
    row.className = 'chatlist-chat active is-muted';
    row.innerHTML = `
      <span class="peer-title">Updated title</span>
      <div class="dialog-subtitle"><span class="dialog-subtitle-span">Draft: hello</span></div>
      <span class="message-time">Now</span>
      <div class="dialog-subtitle-badge badge dialog-subtitle-badge-unread is-visible mention">@</div>
    `;

    refreshDialogRowAccessibility(row);

    expect(row.getAttribute('aria-label')).toContain('Updated title');
    expect(row.getAttribute('aria-label')).toContain('Mention');
    expect(row.getAttribute('aria-current')).toBe('true');
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
    const attach = document.createElement('button');

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
    expect(attach.getAttribute('aria-label')).toBe('Add');
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
    const row = document.createElement('a');
    row.className = 'chatlist-chat row';
    row.href = '#1';
    row.innerHTML = `
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
    `;

    applyDialogRowAccessibility(row, {
      title: 'Alice',
      subtitle: 'See you soon',
      time: '4:20 PM',
      unreadCount: '3'
    });

    expect(countDialogRowAccessibilityTargets(row)).toBe(1);
    expect(row.querySelector('.row-title-row')?.getAttribute('aria-hidden')).toBeNull();
    expect(row.querySelector('.row-title-row .row-title')?.getAttribute('aria-hidden')).toBe('true');
    expect(row.querySelector('.row-subtitle-row')?.getAttribute('aria-hidden')).toBe('true');
    expect(row.querySelector('.dialog-avatar')?.getAttribute('aria-hidden')).toBe('true');
    expect(row.querySelector('.dialog-stories-button')).toBeNull();
  });

  it('exposes chat row and stories button when the peer has stories', () => {
    const row = document.createElement('a');
    row.className = 'chatlist-chat row';
    row.href = '#1';
    row.innerHTML = `
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
    `;

    applyDialogRowAccessibility(row, {
      title: 'Bob',
      subtitle: 'New story',
      time: 'Now'
    });

    const storiesButton = row.querySelector('.dialog-stories-button') as HTMLButtonElement;

    expect(countDialogRowAccessibilityTargets(row)).toBe(2);
    expect(storiesButton).not.toBeNull();
    expect(storiesButton.type).toBe('button');
    expect(storiesButton.getAttribute('aria-label')).toBe('Stories');
    expect(storiesButton.dataset.dialogListAction).toBe('stories');
    expect(row.querySelector('.avatar.has-stories')?.getAttribute('aria-hidden')).toBe('true');
    expect(row.querySelector('.avatar-stories-svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('drops the stories button when stories disappear from a recycled row', () => {
    const row = document.createElement('a');
    row.className = 'chatlist-chat row';
    row.href = '#1';
    row.innerHTML = `
      <div class="row-media dialog-avatar">
        <div class="avatar avatar-like avatar-54 has-stories" data-peer-id="1"></div>
      </div>
      <div class="row-row row-title-row dialog-title">
        <div class="row-title user-title"><span class="peer-title">Bob</span></div>
      </div>
      <div class="row-row row-subtitle-row dialog-subtitle">
        <div class="row-subtitle"><span class="dialog-subtitle-span">Draft</span></div>
      </div>
    `;

    applyDialogRowHitTargets(row);
    expect(row.querySelector('.dialog-stories-button')).not.toBeNull();

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
});
