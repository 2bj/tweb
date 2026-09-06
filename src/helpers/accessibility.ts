import type {MyDraftMessage} from '@appManagers/appDraftsManager';
import type {MyMessage} from '@appManagers/appMessagesManager';
import Icon from '@components/icon';
import ripple from '@components/ripple';
import getPeerTitle from '@components/wrappers/getPeerTitle';
import {formatTime} from '@helpers/date';
import cancelEvent from '@helpers/dom/cancelEvent';
import I18n from '@lib/langPack';

export type ChatListScrollDirection = 'up' | 'down' | 'home' | 'end';

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

export function scrollChatListContainer(container: HTMLElement, direction: ChatListScrollDirection) {
  if(direction === 'home') {
    container.scrollTop = 0;
    return;
  }

  if(direction === 'end') {
    container.scrollTop = container.scrollHeight;
    return;
  }

  const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
  const delta = direction === 'up' ? -container.clientHeight / 2 : container.clientHeight / 2;
  container.scrollTop = Math.min(maxScrollTop, Math.max(0, container.scrollTop + delta));
}

export function handleChatListScrollKeydown(event: KeyboardEvent, container: HTMLElement) {
  if(document.activeElement !== container) {
    return false;
  }

  if(event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
    return false;
  }

  let direction: ChatListScrollDirection;
  switch(event.key) {
    case 'PageUp':
      direction = 'up';
      break;
    case 'PageDown':
      direction = 'down';
      break;
    case 'Home':
      direction = 'home';
      break;
    case 'End':
      direction = 'end';
      break;
    default:
      return false;
  }

  scrollChatListContainer(container, direction);
  cancelEvent(event);
  return true;
}

const chatListScrollControlsByContainer = new WeakMap<HTMLElement, HTMLElement>();

export function relocateChatListScrollControls(container: HTMLElement) {
  const host = container.parentElement;
  if(host?.id !== 'folders-container') {
    return;
  }

  let controls = chatListScrollControlsByContainer.get(container) ?? null;
  if(!controls?.isConnected) {
    controls = container.nextElementSibling as HTMLElement | null;
  }
  if(!controls?.classList.contains('chatlist-scroll-controls')) {
    controls = container.querySelector(':scope > .chatlist-scroll-controls') as HTMLElement | null;
  }

  if(!controls) {
    return;
  }

  chatListScrollControlsByContainer.set(container, controls);

  if(controls.previousElementSibling !== container) {
    container.insertAdjacentElement('afterend', controls);
  }
}

export function applyChatListScrollAccessibility(container: HTMLElement) {
  container.tabIndex = 0;

  const onKeyDown = (event: KeyboardEvent) => {
    handleChatListScrollKeydown(event, container);
  };

  container.addEventListener('keydown', onKeyDown);

  const controls = document.createElement('div');
  controls.className = 'chatlist-scroll-controls';

  const upButton = document.createElement('button');
  upButton.type = 'button';
  upButton.className = 'btn-circle chatlist-scroll-button chatlist-scroll-button-up rp z-depth-1';
  upButton.setAttribute('aria-label', I18n.format('ScrollChatsUp', true));
  upButton.append(Icon('arrow_up'));

  const downButton = document.createElement('button');
  downButton.type = 'button';
  downButton.className = 'btn-circle chatlist-scroll-button chatlist-scroll-button-down rp z-depth-1';
  downButton.setAttribute('aria-label', I18n.format('ScrollChatsDown', true));
  downButton.append(Icon('arrow_down'));

  ripple(upButton);
  ripple(downButton);

  upButton.addEventListener('click', () => scrollChatListContainer(container, 'up'));
  downButton.addEventListener('click', () => scrollChatListContainer(container, 'down'));

  controls.append(upButton, downButton);
  chatListScrollControlsByContainer.set(container, controls);

  const mountControls = () => {
    if(!controls.isConnected) {
      container.append(controls);
    }
    relocateChatListScrollControls(container);
  };

  mountControls();
  queueMicrotask(mountControls);

  return () => {
    container.removeEventListener('keydown', onKeyDown);
    controls.remove();
    chatListScrollControlsByContainer.delete(container);
    container.removeAttribute('tabindex');
  };
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
