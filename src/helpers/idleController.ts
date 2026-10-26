import IS_TOUCH_SUPPORTED from '@environment/touchSupport';
import EventListenerBase from '@helpers/eventListenerBase';
import {IS_PREVIEW} from '@config/debug';
import {bindActiveWindowListener, getAppWindow, onAppWindowChange} from '@helpers/appWindow';

const FOCUS_EVENT_NAME = IS_TOUCH_SUPPORTED ? 'touchstart' : 'mousemove';
const DO_NOT_IDLE = IS_PREVIEW; // the preview window is never focused — don't let it look idle

/** Pause sticker/emoji loops after this long without input while the tab stays focused (Safari energy). */
export const INACTIVITY_IDLE_MS = 90_000;

const ACTIVITY_EVENTS = [
  'keydown',
  'pointerdown',
  'wheel',
  'touchstart',
  FOCUS_EVENT_NAME
] as const;

export class IdleController extends EventListenerBase<{
  change: (idle: boolean) => void
}> {
  private _isIdle: boolean;

  private focusPromise: Promise<void>;
  private focusResolve: () => void;

  private boundWindow: Window;
  private inactivityTimer: number;
  private disposeVisibilityListener: (() => void) | undefined;

  private onBlur = () => {
    this.clearInactivityTimer();
    this.isIdle = true;
  };
  private onFocus = () => {
    this.isIdle = false;
    this.resetInactivityTimer();
  };
  private onUserActivity = () => {
    if(this._isIdle) {
      this.isIdle = false;
    }
    this.resetInactivityTimer();
  };
  private onVisibilityChange = () => {
    const doc = this.boundWindow?.document;
    if(!doc) {
      return;
    }

    if(doc.hidden) {
      this.clearInactivityTimer();
      this.isIdle = true;
    } else if(doc.hasFocus()) {
      this.onUserActivity();
    }
  };

  constructor() {
    super();

    this._isIdle = !DO_NOT_IDLE;
    this.focusPromise = Promise.resolve();
    this.focusResolve = () => {};

    // Track blur/focus/activity on whichever window the app currently lives in — the tab, or the
    // Document PiP window while popped out. Bound to the MAIN window only, the app would look idle the
    // instant the user focuses the PiP (the tab blurs) and pause every animation (media spoilers go
    // blank); and PiP mouse activity would never reach it to wake it back up.
    this.bindWindow(getAppWindow(), false);
    onAppWindowChange((win) => this.bindWindow(win, true));

    this.addEventListener('change', (idle) => {
      if(idle) {
        this.focusPromise = new Promise((resolve) => {
          this.focusResolve = resolve;
        });
      } else {
        this.focusResolve();
      }
    });
  }

  private bindWindow(win: Window, isSwitch: boolean) {
    const prev = this.boundWindow;
    if(prev) {
      prev.removeEventListener('blur', this.onBlur);
      prev.removeEventListener('focus', this.onFocus);
      for(const eventName of ACTIVITY_EVENTS) {
        prev.removeEventListener(eventName, this.onUserActivity);
      }
      this.disposeVisibilityListener?.();
      this.disposeVisibilityListener = undefined;
    }

    this.boundWindow = win;
    win.addEventListener('blur', this.onBlur);
    win.addEventListener('focus', this.onFocus);
    for(const eventName of ACTIVITY_EVENTS) {
      win.addEventListener(eventName, this.onUserActivity, {passive: true});
    }

    this.disposeVisibilityListener = bindActiveWindowListener(
      (w) => w.document,
      'visibilitychange',
      this.onVisibilityChange
    );

    // Moving the app INTO a window (PiP pop-in/out) is itself active use of that window — wake up so
    // animations keep playing even though the window we left has just blurred.
    if(isSwitch) {
      this.isIdle = false;
      this.resetInactivityTimer();
    } else if(!win.document.hidden && win.document.hasFocus()) {
      this.resetInactivityTimer();
    }
  }

  private clearInactivityTimer() {
    if(this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = undefined;
    }
  }

  private resetInactivityTimer() {
    this.clearInactivityTimer();
    if(DO_NOT_IDLE || this._isIdle) {
      return;
    }

    this.inactivityTimer = window.setTimeout(() => {
      this.inactivityTimer = undefined;
      const doc = this.boundWindow?.document;
      if(doc && !doc.hidden) {
        this.isIdle = true;
      }
    }, INACTIVITY_IDLE_MS);
  }

  public getFocusPromise() {
    return this.focusPromise;
  }

  public get isIdle() {
    return this._isIdle;
  }

  public set isIdle(value: boolean) {
    if(this._isIdle === value) {
      return;
    }

    if(DO_NOT_IDLE && value) {
      return;
    }

    this._isIdle = value;
    if(value) {
      this.clearInactivityTimer();
    } else {
      this.resetInactivityTimer();
    }
    this.dispatchEvent('change', value);
  }
}

const idleController = new IdleController();
export default idleController;
