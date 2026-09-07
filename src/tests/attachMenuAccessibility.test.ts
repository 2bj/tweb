import {beforeEach, describe, expect, it, vi} from 'vitest';

vi.mock('@helpers/contextMenuController', () => ({
  default: {close: vi.fn()}
}));
vi.mock('@environment/userAgent', () => ({IS_MOBILE: false}));
vi.mock('@components/avatarNew', () => ({AvatarNew: vi.fn()}));
vi.mock('@components/icon', () => ({
  default: () => document.createElement('span')
}));
vi.mock('@components/putPreloader', () => ({
  putPreloader: () => document.createElement('span')
}));
vi.mock('@components/ripple', () => ({default: vi.fn()}));
vi.mock('@components/wrappers/attachBotIcon', () => ({default: vi.fn()}));
vi.mock('@components/checkboxField', () => ({
  default: class {
    public input = document.createElement('input');
    public label = document.createElement('span');
  }
}));
vi.mock('@lib/langPack', () => ({
  default: {
    format: (key: string, plain?: boolean) => plain ? key : key
  },
  _i18n: vi.fn(),
  i18n: (key: string) => {
    const element = document.createElement('span');
    element.textContent = key;
    return element;
  }
}));

import {ButtonMenuSync} from '@components/buttonMenu';

describe('attach menu accessibility', () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it('labels attach menu items with their lang keys', () => {
    const menu = ButtonMenuSync({
      buttons: [{
        text: 'Chat.Input.Attach.PhotoOrVideo',
        onClick: vi.fn()
      }, {
        text: 'Chat.Input.Attach.Document',
        onClick: vi.fn()
      }]
    });
    menu.classList.add('active');
    const items = menu.querySelectorAll<HTMLElement>('.btn-menu-item');

    expect(items[0].getAttribute('role')).toBe('button');
    expect(items[0].getAttribute('aria-label')).toBe('Chat.Input.Attach.PhotoOrVideo');
    expect(items[1].getAttribute('aria-label')).toBe('Chat.Input.Attach.Document');
  });
});
