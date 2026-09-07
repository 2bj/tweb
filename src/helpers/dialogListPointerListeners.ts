import cancelEvent from '@helpers/dom/cancelEvent';
import findUpTag from '@helpers/dom/findUpTag';

const DIALOG_LIST_ELEMENT_TAG = 'A';
const ARCHIVE_DIALOG_TAG = 'archive-dialog';

function findDialogListElement(target: EventTarget) {
  return findUpTag(target, DIALOG_LIST_ELEMENT_TAG);
}

export type DialogListPointerEvent = Pick<MouseEvent, 'target' | 'button' | 'shiftKey' | 'ctrlKey' | 'metaKey' | 'clientX' | 'clientY'>;

export type DialogListPointerListenerOptions = {
  list: HTMLElement,
  isDialogListAction: (target: EventTarget) => boolean,
  setWillOpenStory: (e: Event) => boolean,
  isOpeningStoriesDisabled: () => boolean,
  getOpenStoryCallback: (target: EventTarget) => (() => void) | undefined,
  handleListActivation: (e: DialogListPointerEvent) => boolean
};

export function attachDialogListPointerListeners({
  list,
  isDialogListAction,
  setWillOpenStory,
  isOpeningStoriesDisabled,
  getOpenStoryCallback,
  handleListActivation
}: DialogListPointerListenerOptions) {
  let willOpenStory = false;
  let handledByPointerDown = false;

  const markWillOpenStory = (e: Event) => {
    willOpenStory = setWillOpenStory(e);
    return willOpenStory;
  };

  list.addEventListener('mousedown', (e) => {
    if(
      e.button !== 0 ||
      markWillOpenStory(e) ||
      isDialogListAction(e.target)
    ) {
      return;
    }

    if(handleListActivation(e)) {
      handledByPointerDown = true;
    }
  }, {capture: true});

  // cancel link click
  // ! do not change it to attachClickEvent
  list.addEventListener('click', (e) => {
    if(isDialogListAction(e.target)) {
      return;
    }

    if(e.button === 0) {
      cancelEvent(e);
    }

    if(!isOpeningStoriesDisabled()) {
      const storyCallback = getOpenStoryCallback(e.target);
      if(storyCallback && (willOpenStory || !handledByPointerDown)) {
        storyCallback();
        handledByPointerDown = false;
        willOpenStory = false;
        return;
      }
    }

    if(!handledByPointerDown) {
      handleListActivation(e);
    }

    handledByPointerDown = false;
    willOpenStory = false;
  }, {capture: true});

  list.addEventListener('keydown', (e: KeyboardEvent) => {
    if(e.key !== ' ' || e.repeat || isDialogListAction(e.target)) {
      return;
    }

    if(markWillOpenStory(e)) {
      return;
    }

    const target = e.target as HTMLElement;
    if(!findUpTag(target, ARCHIVE_DIALOG_TAG) && !findDialogListElement(target)) {
      return;
    }

    cancelEvent(e);
    handleListActivation(e);
  }, {capture: true});
}
