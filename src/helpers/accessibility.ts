import type {MyDraftMessage} from '@appManagers/appDraftsManager';
import type {MyMessage} from '@appManagers/appMessagesManager';
import Icon from '@components/icon';
import ripple from '@components/ripple';
import cancelEvent from '@helpers/dom/cancelEvent';
import {attachClickEvent} from '@helpers/dom/clickEvent';
import getPeerTitle from '@components/wrappers/getPeerTitle';
import {formatTime} from '@helpers/date';
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

export function getActiveMessagesScrollContainer(): HTMLElement | null {
  const column = document.getElementById('column-center');
  if(!column) {
    return null;
  }

  const activeChat = column.querySelector('.chat.active') ?? column;
  return activeChat.querySelector('.bubbles-scrollable') as HTMLElement | null;
}

export function getActiveChatListContainer(): HTMLElement | null {
  return document.querySelector('#folders-container .folders-scrollable.active') as HTMLElement | null;
}

const pairedColumnScrollTops = new WeakMap<HTMLElement, number>();
let pairedColumnScrollLock = 0;

export function rememberPairedColumnScrollPositions() {
  const list = getActiveChatListContainer();
  const messages = getActiveMessagesScrollContainer();
  if(list) {
    pairedColumnScrollTops.set(list, list.scrollTop);
  }
  if(messages) {
    pairedColumnScrollTops.set(messages, messages.scrollTop);
  }
}

function isPairedColumnScrollable(element: HTMLElement) {
  return element.classList.contains('bubbles-scrollable') ||
    (element.classList.contains('folders-scrollable') && element.classList.contains('active'));
}

function getPairedColumnScrollTarget(source: HTMLElement): HTMLElement | null {
  if(source.classList.contains('bubbles-scrollable')) {
    return getActiveChatListContainer();
  }

  if(source.classList.contains('folders-scrollable')) {
    return getActiveMessagesScrollContainer();
  }

  return null;
}

export function isPageLikeColumnScroll(element: HTMLElement, delta: number) {
  const abs = Math.abs(delta);
  const page = element.clientHeight;
  return abs >= Math.max(64, page * 0.2) && abs <= page * 1.5;
}

export function isColumnAtScrollLimit(element: HTMLElement, direction: 'up' | 'down') {
  const maxScrollTop = Math.max(0, element.scrollHeight - element.clientHeight);
  if(direction === 'up') {
    return element.scrollTop <= 1;
  }

  return element.scrollTop >= maxScrollTop - 1;
}

export function scrollBothColumnsIndependently(direction: 'up' | 'down', chatList?: HTMLElement) {
  pairedColumnScrollLock++;
  try {
    const list = getActiveChatListContainer() ?? chatList;
    const messages = getActiveMessagesScrollContainer();
    if(list) {
      scrollChatListContainer(list, direction);
    }
    if(messages && messages !== list) {
      scrollChatListContainer(messages, direction);
    }
    rememberPairedColumnScrollPositions();
  } finally {
    pairedColumnScrollLock--;
  }
}

function isTypingScrollTarget(target: EventTarget | null) {
  if(!(target instanceof HTMLElement)) {
    return false;
  }

  if(target.isContentEditable) {
    return true;
  }

  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

export function handleIndependentColumnPageKey(event: KeyboardEvent) {
  if(event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
    return;
  }

  if(event.key !== 'PageDown' && event.key !== 'PageUp') {
    return;
  }

  if(isTypingScrollTarget(event.target) || isTypingScrollTarget(document.activeElement)) {
    return;
  }

  const active = document.activeElement;
  if(active instanceof HTMLElement && active.closest('.folders-scrollable')) {
    return;
  }

  cancelEvent(event);
  scrollBothColumnsIndependently(event.key === 'PageDown' ? 'down' : 'up');
}

let independentColumnPageKeysBound = false;

function ensureIndependentColumnPageKeys() {
  if(independentColumnPageKeysBound) {
    return;
  }

  independentColumnPageKeysBound = true;
  document.addEventListener('keydown', handleIndependentColumnPageKey, true);
}

export function handlePairedColumnScrollEvent(event: Event) {
  const element = (
    event.currentTarget instanceof HTMLElement && isPairedColumnScrollable(event.currentTarget) ?
      event.currentTarget :
      event.target
  );
  if(!(element instanceof HTMLElement) || !isPairedColumnScrollable(element)) {
    return;
  }

  const top = element.scrollTop;
  const previous = pairedColumnScrollTops.get(element);
  pairedColumnScrollTops.set(element, top);

  if(pairedColumnScrollLock || previous === undefined) {
    return;
  }

  const delta = top - previous;
  if(!isPageLikeColumnScroll(element, delta)) {
    return;
  }

  const other = getPairedColumnScrollTarget(element);
  if(!other || other === element) {
    return;
  }

  pairedColumnScrollLock++;
  try {
    scrollChatListContainer(other, delta > 0 ? 'down' : 'up');
    pairedColumnScrollTops.set(other, other.scrollTop);
  } finally {
    pairedColumnScrollLock--;
  }
}

export function handlePairedColumnWheelEvent(event: WheelEvent) {
  if(pairedColumnScrollLock) {
    return;
  }

  const element = event.currentTarget instanceof HTMLElement && isPairedColumnScrollable(event.currentTarget) ?
    event.currentTarget :
    event.target;
  if(!(element instanceof HTMLElement) || !isPairedColumnScrollable(element)) {
    return;
  }

  if(!event.deltaY) {
    return;
  }

  const direction: 'up' | 'down' = event.deltaY < 0 ? 'up' : 'down';

  const pageLike = event.deltaMode === WheelEvent.DOM_DELTA_PAGE ||
    Math.abs(event.deltaY) >= Math.max(64, element.clientHeight * 0.2);
  if(!pageLike && !isColumnAtScrollLimit(element, direction)) {
    return;
  }

  if(event.cancelable) {
    cancelEvent(event);
  }

  scrollBothColumnsIndependently(direction);
}

export function bindPairedColumnScrollSource(element: HTMLElement) {
  element.addEventListener('scroll', handlePairedColumnScrollEvent, {passive: true});
  element.addEventListener('wheel', handlePairedColumnWheelEvent, {passive: false});
  pairedColumnScrollTops.set(element, element.scrollTop);
  ensureIndependentColumnPageKeys();
}

export function unbindPairedColumnScrollSource(element: HTMLElement) {
  element.removeEventListener('scroll', handlePairedColumnScrollEvent);
  element.removeEventListener('wheel', handlePairedColumnWheelEvent);
  pairedColumnScrollTops.delete(element);
}

export function scrollSyncedColumns(chatList: HTMLElement, direction: ChatListScrollDirection) {
  if(direction === 'up' || direction === 'down') {
    scrollBothColumnsIndependently(direction, chatList);
    return;
  }

  pairedColumnScrollLock++;
  try {
    scrollChatListContainer(chatList, direction);
    rememberPairedColumnScrollPositions();
  } finally {
    pairedColumnScrollLock--;
  }
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

  if(direction === 'up' || direction === 'down') {
    scrollSyncedColumns(container, direction);
  } else {
    scrollChatListContainer(container, direction);
  }
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
  bindPairedColumnScrollSource(container);
  rememberPairedColumnScrollPositions();

  const onKeyDown = (event: KeyboardEvent) => {
    handleChatListScrollKeydown(event, container);
  };

  container.addEventListener('keydown', onKeyDown);

  const controls = document.createElement('div');
  controls.className = 'chatlist-scroll-controls';

  const upButton = document.createElement('button');
  upButton.type = 'button';
  upButton.className = 'chatlist-scroll-button chatlist-scroll-button-up';
  upButton.setAttribute('aria-label', I18n.format('ScrollChatsUp', true));

  const downButton = document.createElement('button');
  downButton.type = 'button';
  downButton.className = 'chatlist-scroll-button chatlist-scroll-button-down';
  downButton.setAttribute('aria-label', I18n.format('ScrollChatsDown', true));

  upButton.addEventListener('click', () => scrollSyncedColumns(container, 'up'));
  downButton.addEventListener('click', () => scrollSyncedColumns(container, 'down'));

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
    unbindPairedColumnScrollSource(container);
    controls.remove();
    chatListScrollControlsByContainer.delete(container);
    container.removeAttribute('tabindex');
  };
}

const DIALOG_STORIES_BUTTON_CLASS = 'dialog-stories-button';
const DIALOG_CHAT_LINK_CLASS = 'dialog-chat-link';
const DIALOG_A11Y_LABEL_CLASS = 'dialog-a11y-label';

const DIALOG_ROW_DECORATIVE_SELECTORS = [
  '.row-title-row .row-title',
  '.row-title-row .message-status',
  '.row-title-row .message-time',
  '.row-subtitle-row',
  '.avatar-badge',
  '.dialog-group-call-icon'
];

const DIALOG_ROW_AVATAR_DECORATIVE_SELECTORS = [
  '.avatar-stories-svg',
  '.avatar-stories-simple',
  'canvas',
  '.avatar'
];

function hideFromAccessibilityTree(element: Element) {
  element.setAttribute('aria-hidden', 'true');

  if(element instanceof HTMLElement && element.hasAttribute('tabindex')) {
    element.tabIndex = -1;
  }
}

function isAccessibilityTarget(element: Element) {
  if(!(element instanceof HTMLElement)) {
    return false;
  }

  if(element.hidden) {
    return false;
  }

  if(element.getAttribute('aria-hidden') === 'true') {
    return false;
  }

  if(element.closest('[aria-hidden="true"]')) {
    return false;
  }

  if(element.matches('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [contenteditable="true"], [tabindex]:not([tabindex="-1"])')) {
    return true;
  }

  const role = element.getAttribute('role');
  return role === 'button' || role === 'link';
}

export function countDialogRowAccessibilityTargets(listEl: HTMLElement) {
  const targets = new Set<HTMLElement>();

  if(isAccessibilityTarget(listEl)) {
    targets.add(listEl);
  }

  listEl.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [contenteditable="true"], [tabindex]:not([tabindex="-1"]), [role="button"], [role="link"]').forEach((element) => {
    if(isAccessibilityTarget(element)) {
      targets.add(element as HTMLElement);
    }
  });

  return targets.size;
}

function getDialogRowMedia(listEl: HTMLElement) {
  return listEl.querySelector('.dialog-avatar.row-media, .row-media.dialog-avatar') as HTMLElement | null;
}

function removeDialogStoriesButton(listEl: HTMLElement) {
  listEl.querySelector(`.${DIALOG_STORIES_BUTTON_CLASS}`)?.remove();
}

function applyDialogChatLink(listEl: HTMLElement, label: string) {
  const rowIsLink = listEl.matches('a[href]');
  let link = rowIsLink ?
    listEl as HTMLAnchorElement :
    listEl.querySelector(`:scope > a.${DIALOG_CHAT_LINK_CLASS}`) as HTMLAnchorElement | null;

  if(!link) {
    link = document.createElement('a');
    link.className = DIALOG_CHAT_LINK_CLASS;
    listEl.prepend(link);
  }

  const peerId = listEl.dataset.peerId;
  if(link !== listEl) {
    link.href = '#' + (peerId || '');
  }

  let name = link.querySelector(`.${DIALOG_A11Y_LABEL_CLASS}`);
  if(label) {
    if(!name) {
      name = document.createElement('span');
      name.className = DIALOG_A11Y_LABEL_CLASS;
      link.append(name);
    }
    name.textContent = label;
  } else {
    name?.remove();
  }

  if(link !== listEl) {
    listEl.removeAttribute('aria-label');
  }
}

function applyDialogStoriesButton(listEl: HTMLElement) {
  const media = getDialogRowMedia(listEl);
  const hasStories = !!listEl.querySelector('.avatar.has-stories');

  if(!hasStories || !media) {
    removeDialogStoriesButton(listEl);
    if(media) {
      hideFromAccessibilityTree(media);
    }
    return;
  }

  media.removeAttribute('aria-hidden');

  let button = media.querySelector(`.${DIALOG_STORIES_BUTTON_CLASS}`) as HTMLButtonElement | null;
  if(!button) {
    button = document.createElement('button');
    button.type = 'button';
    button.className = DIALOG_STORIES_BUTTON_CLASS;
    button.dataset.dialogListAction = 'stories';
    button.addEventListener('mousedown', (event) => event.stopPropagation());
    button.addEventListener('keydown', (event) => {
      if(event.key === 'Enter' || event.key === ' ') {
        event.stopPropagation();
      }
    });
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();

      const avatar = listEl.querySelector('.avatar.has-stories') as HTMLElement;
      if(!avatar) {
        return;
      }

      void import('@lib/appImManager').then(({default: appImManager}) => {
        appImManager.openStoriesFromAvatar(avatar);
      });
    });
    media.append(button);
  }

  button.setAttribute('aria-label', I18n.format('Stories', true));
  button.tabIndex = 0;

  for(const selector of DIALOG_ROW_AVATAR_DECORATIVE_SELECTORS) {
    media.querySelectorAll(selector).forEach(hideFromAccessibilityTree);
  }
}

export function applyDialogRowHitTargets(listEl: HTMLElement) {
  listEl.querySelector('.c-ripple')?.setAttribute('aria-hidden', 'true');

  for(const selector of DIALOG_ROW_DECORATIVE_SELECTORS) {
    listEl.querySelectorAll(selector).forEach(hideFromAccessibilityTree);
  }

  applyDialogStoriesButton(listEl);
  syncDialogChatMenuButton(listEl);
}

export function applyDialogRowAccessibility(listEl: HTMLElement, state: DialogRowAccessibilityState) {
  const label = buildDialogAccessibleName(state);
  applyDialogChatLink(listEl, label);

  // Safari VoiceOver Show Numbers only counts links/buttons. `role="listitem"` on
  // the row `<a>` replaces the native link, so the chat disappears and only the
  // nested stories `<button>` remains. Keep listitem on a non-link wrapper.
  if(listEl.matches('a[href]')) {
    listEl.removeAttribute('role');
  } else {
    listEl.setAttribute('role', 'listitem');
  }

  if(state.isActive) {
    listEl.setAttribute('aria-current', 'true');
  } else {
    listEl.removeAttribute('aria-current');
  }

  applyDialogRowHitTargets(listEl);
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

export function shouldShowDialogChatMenu(options: {
  autonomous?: boolean,
  asAllChats?: 'monoforum' | 'topics',
  withChatMenu?: boolean
}) {
  if(options.withChatMenu !== undefined) {
    return options.withChatMenu;
  }

  return !options.autonomous && !options.asAllChats;
}

export function syncDialogChatMenuButton(
  listEl: HTMLElement,
  menuButton?: HTMLButtonElement | null
) {
  const button = menuButton ??
    listEl.querySelector('.dialog-chat-menu-button') as HTMLButtonElement | null;
  if(!button) {
    return;
  }

  const isActive = listEl.classList.contains('active');
  button.hidden = !isActive;
  button.tabIndex = isActive ? 0 : -1;
}

export function createDialogChatMenuButton(onOpen: (event: MouseEvent) => void) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn-icon dialog-chat-menu-button rp';
  button.dataset.dialogListAction = 'true';
  button.setAttribute('aria-label', I18n.format('ChatMenu', true));
  button.append(Icon('more', 'dialog-chat-menu-button-icon'));
  button.hidden = true;
  button.tabIndex = -1;

  button.addEventListener('mousedown', (event) => event.stopPropagation());
  button.addEventListener('keydown', (event) => {
    if(event.key === 'Enter' || event.key === ' ') {
      event.stopPropagation();
    }
  });

  ripple(button);
  attachClickEvent(button, (event) => {
    cancelEvent(event);
    onOpen(event);
  }, {ignoreMove: true});

  return button;
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
  button.setAttribute('aria-label', I18n.format('Attach', true));
  if(!(button instanceof HTMLButtonElement)) {
    button.setAttribute('role', 'button');
    button.tabIndex = 0;
  }
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

export type FolderItemAccessibilityState = {
  title: string,
  unreadCount?: number,
  isMuted?: boolean,
  selected?: boolean
};

export function buildFolderAccessibleName(state: FolderItemAccessibilityState): string {
  const parts: string[] = [];

  if(state.title) {
    parts.push(state.title);
  }

  if(state.unreadCount && state.unreadCount > 0) {
    parts.push(I18n.format('messages', true, [state.unreadCount]));
  }

  if(state.isMuted) {
    parts.push(I18n.format('NotificationsMuted', true));
  }

  return joinAccessibleParts(parts);
}

export function applyFoldersNavigationLandmark(element: HTMLElement) {
  element.setAttribute('role', 'navigation');
  element.setAttribute('aria-label', I18n.format('ChatList.Filter.List.Title', true));
}

const FOLDER_ITEM_DECORATIVE_SELECTORS = [
  '.folders-sidebar__folder-item-icon',
  '.folders-sidebar__folder-item-animated-icon',
  '.folders-sidebar__folder-item-badge',
  '.menu-horizontal-div-item-background',
  '.tgico',
  'custom-emoji-renderer-element',
  '.badge'
];

export function applyFolderItemAccessibility(element: HTMLElement, state: FolderItemAccessibilityState) {
  element.setAttribute('role', 'button');
  element.tabIndex = 0;

  const label = buildFolderAccessibleName(state);
  if(label) {
    element.setAttribute('aria-label', label);
  } else {
    element.removeAttribute('aria-label');
  }

  if(state.selected) {
    element.setAttribute('aria-current', 'true');
  } else {
    element.removeAttribute('aria-current');
  }

  for(const selector of FOLDER_ITEM_DECORATIVE_SELECTORS) {
    element.querySelectorAll(selector).forEach(hideFromAccessibilityTree);
  }
}

export function handleFolderItemKeydown(event: KeyboardEvent, activate: () => void) {
  if(event.repeat) {
    return;
  }

  if(event.key !== 'Enter' && event.key !== ' ') {
    return;
  }

  event.preventDefault();
  activate();
}
