import {describe, expect, it, vi} from 'vitest';
import {attachDialogListPointerListeners} from '@helpers/dialogListPointerListeners';

describe('dialog list pointer listeners', () => {
  it('opens a chat from click when pointerdown did not run', () => {
    const activate = vi.fn(() => true);
    const list = document.createElement('ul');
    const row = document.createElement('a');
    row.dataset.peerId = '1';
    list.append(row);

    attachDialogListPointerListeners({
      list,
      isDialogListAction: () => false,
      setWillOpenStory: () => false,
      isOpeningStoriesDisabled: () => false,
      getOpenStoryCallback: () => undefined,
      handleListActivation: activate
    });

    row.dispatchEvent(new MouseEvent('click', {bubbles: true, button: 0, cancelable: true}));

    expect(activate).toHaveBeenCalledOnce();
  });

  it('does not open the chat twice when mousedown already handled it', () => {
    const activate = vi.fn(() => true);
    const list = document.createElement('ul');
    const row = document.createElement('a');
    row.dataset.peerId = '1';
    list.append(row);

    attachDialogListPointerListeners({
      list,
      isDialogListAction: () => false,
      setWillOpenStory: () => false,
      isOpeningStoriesDisabled: () => false,
      getOpenStoryCallback: () => undefined,
      handleListActivation: activate
    });

    row.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, button: 0}));
    row.dispatchEvent(new MouseEvent('click', {bubbles: true, button: 0, cancelable: true}));

    expect(activate).toHaveBeenCalledTimes(1);
  });

  it('opens stories from click when pointerdown did not run', () => {
    const openStory = vi.fn();
    const list = document.createElement('ul');
    const row = document.createElement('a');
    row.innerHTML = '<div class="avatar has-stories"></div>';
    list.append(row);

    attachDialogListPointerListeners({
      list,
      isDialogListAction: () => false,
      setWillOpenStory: () => true,
      isOpeningStoriesDisabled: () => false,
      getOpenStoryCallback: () => openStory,
      handleListActivation: vi.fn(() => true)
    });

    row.dispatchEvent(new MouseEvent('click', {bubbles: true, button: 0, cancelable: true}));

    expect(openStory).toHaveBeenCalledOnce();
  });

  it('ignores dialog-list-action targets on click', () => {
    const activate = vi.fn(() => true);
    const list = document.createElement('ul');
    const row = document.createElement('a');
    const menuButton = document.createElement('button');
    menuButton.dataset.dialogListAction = 'true';
    row.append(menuButton);
    list.append(row);

    attachDialogListPointerListeners({
      list,
      isDialogListAction: (target) => !!(target as HTMLElement).closest?.('[data-dialog-list-action]'),
      setWillOpenStory: () => false,
      isOpeningStoriesDisabled: () => false,
      getOpenStoryCallback: () => undefined,
      handleListActivation: activate
    });

    menuButton.dispatchEvent(new MouseEvent('click', {bubbles: true, button: 0}));

    expect(activate).not.toHaveBeenCalled();
  });

  it('activates archive or chat rows from Space without pointerdown', () => {
    const activate = vi.fn(() => true);
    const list = document.createElement('ul');
    const archive = document.createElement('archive-dialog');
    list.append(archive);

    attachDialogListPointerListeners({
      list,
      isDialogListAction: () => false,
      setWillOpenStory: () => false,
      isOpeningStoriesDisabled: () => false,
      getOpenStoryCallback: () => undefined,
      handleListActivation: activate
    });

    archive.dispatchEvent(new KeyboardEvent('keydown', {bubbles: true, key: ' ', cancelable: true}));

    expect(activate).toHaveBeenCalledOnce();
  });
});
