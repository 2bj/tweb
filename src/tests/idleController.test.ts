import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest';
import {IdleController, INACTIVITY_IDLE_MS} from '@helpers/idleController';

describe('IdleController inactivity', () => {
  let controller: IdleController;

  beforeEach(() => {
    vi.useFakeTimers();
    controller = new IdleController();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('enters idle after inactivity while the window stays focused', () => {
    controller.isIdle = false;
    expect(controller.isIdle).toBe(false);

    vi.advanceTimersByTime(INACTIVITY_IDLE_MS);

    expect(controller.isIdle).toBe(true);
  });

  test('user activity resets the inactivity timer', () => {
    controller.isIdle = false;
    vi.advanceTimersByTime(INACTIVITY_IDLE_MS - 1000);
    window.dispatchEvent(new Event('keydown'));
    vi.advanceTimersByTime(INACTIVITY_IDLE_MS - 1000);

    expect(controller.isIdle).toBe(false);

    vi.advanceTimersByTime(2000);
    expect(controller.isIdle).toBe(true);
  });

  test('hidden document forces idle', () => {
    controller.isIdle = false;
    Object.defineProperty(document, 'hidden', {configurable: true, value: true});
    document.dispatchEvent(new Event('visibilitychange'));
    expect(controller.isIdle).toBe(true);
    Object.defineProperty(document, 'hidden', {configurable: true, value: false});
  });
});
