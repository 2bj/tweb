import {describe, expect, it, vi} from 'vitest';

vi.mock('@helpers/contextMenuController', () => ({
  default: {close: vi.fn(), openBtnMenu: vi.fn()}
}));
vi.mock('@components/buttonIcon', () => ({default: vi.fn()}));
vi.mock('@components/buttonMenu', () => ({default: vi.fn()}));
vi.mock('@helpers/array/filterAsync', () => ({default: vi.fn()}));
vi.mock('@helpers/schedulers', () => ({doubleRaf: vi.fn()}));
vi.mock('@helpers/callbackify', () => ({default: (_: unknown, fn: (v: unknown) => void) => fn(undefined)}));
vi.mock('@helpers/dom/findUpClassName', () => ({default: vi.fn()}));
vi.mock('@helpers/positionMenu', () => ({positionMenuTrigger: vi.fn()}));
vi.mock('@helpers/appWindow', () => ({
  getAppWindow: () => window,
  getOverlayRoot: () => document.body,
  onAppWindowChange: vi.fn()
}));
vi.mock('@helpers/dom/fullScreen', () => ({getFullScreenElement: (): HTMLElement => null}));
vi.mock('@environment/touchSupport', () => ({default: false}));

import {ButtonMenuToggleHandler} from '@components/buttonMenuToggle';
import * as clickEvent from '@helpers/dom/clickEvent';

describe('ButtonMenuToggleHandler ignoreMove', () => {
  it('opens when ignoreMove bypasses hasMouseMovedSinceDown', () => {
    const movedSpy = vi.spyOn(clickEvent, 'hasMouseMovedSinceDown').mockReturnValue(true);
    const onOpen = vi.fn();
    const button = document.createElement('div');
    button.classList.add('btn-menu-toggle');

    try {
      ButtonMenuToggleHandler({
        el: button,
        onOpen,
        options: {ignoreMove: true}
      });

      button.dispatchEvent(new MouseEvent(clickEvent.CLICK_EVENT_NAME, {bubbles: true, cancelable: true}));

      expect(onOpen).toHaveBeenCalledTimes(1);
    } finally {
      movedSpy.mockRestore();
    }
  });
});
