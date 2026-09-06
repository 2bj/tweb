import type {MyDraftMessage} from '@appManagers/appDraftsManager';
import type {MyMessage} from '@appManagers/appMessagesManager';
import getPeerTitle from '@components/wrappers/getPeerTitle';
import {formatTime} from '@helpers/date';
import I18n from '@lib/langPack';

export type DialogRowAccessibilityState = {
  title?: string,
  subtitle?: string,
  time?: string,
  unreadCount?: string,
  isMention?: boolean,
  isMuted?: boolean,
  isActive?: boolean
};

export function getElementPlainText(element?: Element | null): string {
  if(!element) {
    return '';
  }

  return (element.textContent || '').replace(/\s+/g, ' ').trim();
}

export function joinAccessibleParts(parts: Array<string | undefined | null | false>): string {
  return parts.filter(Boolean).join(', ');
}

export function buildDialogAccessibleName(state: DialogRowAccessibilityState): string {
  const parts: string[] = [];

  if(state.title) {
    parts.push(state.title);
  }

  if(state.unreadCount !== undefined) {
    if(state.isMention || state.unreadCount === '@') {
      parts.push(I18n.format('Mention', true));
    } else if(state.unreadCount.trim()) {
      parts.push(I18n.format('messages', true, [+state.unreadCount || 1]));
    } else {
      parts.push(I18n.format('UnreadMessages', true));
    }
  }

  if(state.isMuted) {
    parts.push(I18n.format('NotificationsMuted', true));
  }

  if(state.subtitle) {
    parts.push(state.subtitle);
  }

  if(state.time) {
    parts.push(state.time);
  }

  return joinAccessibleParts(parts);
}

export function applyChatListAccessibility(list: HTMLElement, label?: string) {
  list.setAttribute('role', 'list');
  if(label) {
    list.setAttribute('aria-label', label);
  }
}

export function applyDialogRowAccessibility(listEl: HTMLElement, state: DialogRowAccessibilityState) {
  listEl.setAttribute('role', 'listitem');

  const label = buildDialogAccessibleName(state);
  if(label) {
    listEl.setAttribute('aria-label', label);
  } else {
    listEl.removeAttribute('aria-label');
  }

  if(state.isActive) {
    listEl.setAttribute('aria-current', 'true');
  } else {
    listEl.removeAttribute('aria-current');
  }
}

export function buildDialogAccessibilityStateFromElement(listEl: HTMLElement): DialogRowAccessibilityState {
  const unreadBadge = listEl.querySelector('.dialog-subtitle-badge-unread.is-visible') as HTMLElement | null;
  const isMention = !!unreadBadge?.classList.contains('mention');
  let unreadCount: string | undefined;

  if(unreadBadge) {
    unreadCount = (unreadBadge.textContent || '').trim();
    if(isMention) {
      unreadCount = '@';
    }
  }

  return {
    title: getElementPlainText(listEl.querySelector('.peer-title')),
    subtitle: getElementPlainText(listEl.querySelector('.dialog-subtitle')),
    time: getElementPlainText(listEl.querySelector('.message-time')),
    unreadCount,
    isMention,
    isMuted: listEl.classList.contains('is-muted'),
    isActive: listEl.classList.contains('active')
  };
}

export function refreshDialogRowAccessibility(listEl: HTMLElement) {
  applyDialogRowAccessibility(listEl, buildDialogAccessibilityStateFromElement(listEl));
}

export function applyChatNavigationLandmark(element: HTMLElement) {
  element.setAttribute('role', 'navigation');
  element.setAttribute('aria-label', I18n.format('FilterChats', true));
}

export function applyMessagesFeedLandmark(element: HTMLElement, label?: string) {
  element.setAttribute('role', 'region');
  element.setAttribute('aria-label', label || I18n.format('KeyboardShortcuts.Section.Messages', true));
}

export function updateMessagesFeedLandmark(element: HTMLElement, chatTitle: string) {
  applyMessagesFeedLandmark(element, joinAccessibleParts([chatTitle, I18n.format('KeyboardShortcuts.Section.Messages', true)]));
}

export function applyComposerLandmark(element: HTMLElement) {
  element.setAttribute('role', 'region');
  element.setAttribute('aria-label', I18n.format('SendMessageTitle', true));
}

export function applyMessageInputAccessibility(input: HTMLElement) {
  input.setAttribute('role', 'textbox');
  input.setAttribute('aria-multiline', 'true');
  input.setAttribute('aria-label', I18n.format('Message', true));
}

export function applySendButtonAccessibility(button: HTMLElement) {
  button.setAttribute('aria-label', I18n.format('Send', true));
}

export function applyAttachButtonAccessibility(button: HTMLElement) {
  button.setAttribute('aria-label', I18n.format('Add', true));
}

export function applyDateBubbleAccessibility(bubble: HTMLElement) {
  bubble.setAttribute('role', 'heading');
  bubble.setAttribute('aria-level', '2');
  bubble.setAttribute('aria-label', getElementPlainText(bubble));
}

function getMessageTimeLabel(message: {date?: number}) {
  if(!message.date) {
    return '';
  }

  const timeElement = formatTime(new Date(message.date * 1000));
  return getElementPlainText(timeElement);
}

export async function buildBubbleAccessibleName(options: {
  message: MyMessage | MyDraftMessage,
  isOutgoing: boolean
}): Promise<string> {
  const wrapMessageForReply = (await import('@components/wrappers/messageForReply')).default;
  const content = await wrapMessageForReply({
    message: options.message,
    plain: true
  });

  let author: string;
  if(options.isOutgoing) {
    author = I18n.format('FromYou', true);
  } else if((options.message as MyMessage).fromId) {
    author = await getPeerTitle({
      peerId: (options.message as MyMessage).fromId,
      plainText: true
    });
  }

  return joinAccessibleParts([
    author,
    content,
    getMessageTimeLabel(options.message),
    options.isOutgoing ? 'sent' : 'received'
  ]);
}

export async function applyBubbleAccessibility(options: {
  bubble: HTMLElement,
  message: MyMessage | MyDraftMessage,
  isOutgoing: boolean
}) {
  if(options.bubble.classList.contains('is-date')) {
    applyDateBubbleAccessibility(options.bubble);
    return;
  }

  options.bubble.setAttribute('role', 'article');
  options.bubble.setAttribute(
    'aria-label',
    await buildBubbleAccessibleName(options)
  );
}
