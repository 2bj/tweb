import Icon from '@components/icon';
import {ChatType} from '@components/chat/chatType';
import {attachClickEvent} from '@helpers/dom/clickEvent';
import ListenerSetter from '@helpers/listenerSetter';
import I18n from '@lib/langPack';

export function shouldShowMessageMenuButton(options: {
  previewOnly?: boolean,
  chatType: ChatType,
  bubble: HTMLElement
}) {
  const {previewOnly, chatType, bubble} = options;
  if(previewOnly || chatType === ChatType.Static) {
    return false;
  }

  if(
    bubble.classList.contains('service') ||
    bubble.classList.contains('is-date') ||
    bubble.classList.contains('bubble-first') ||
    bubble.classList.contains('botforum-new-topic-bubble') ||
    bubble.classList.contains('is-sponsored')
  ) {
    return false;
  }

  return !!bubble.dataset.mid;
}

export function appendMessageMenuButton(options: {
  bubble: HTMLElement,
  bubbleContainer: HTMLElement,
  onOpen: (e: MouseEvent) => void,
  listenerSetter: ListenerSetter
}) {
  const {bubble, bubbleContainer, onOpen, listenerSetter} = options;
  const button = document.createElement('button');
  button.type = 'button';
  button.classList.add('bubble-beside-button', 'message-menu');
  if(bubble.classList.contains('with-beside-button')) {
    button.classList.add('bubble-beside-button--lifted');
  }
  button.setAttribute('aria-label', I18n.format('MessageMenu', true));
  button.append(Icon('more'));
  attachClickEvent(button, (e) => {
    onOpen(e as MouseEvent);
  }, {listenerSetter});
  bubbleContainer.append(button);
}
