// A finger, as the app's touch handlers read it (touches[0].clientX/Y).
// WebKit has no Touch constructor, so each event is a plain one carrying its
// own touch lists; it reaches the same listeners in every browser.
import type { Locator } from '@playwright/test';

type Step = { type: 'touchstart' | 'touchmove' | 'touchend'; x: number; y: number };

async function finger(target: Locator, steps: Step[]) {
  await target.evaluate((el, steps) => {
    for (const { type, x, y } of steps) {
      const e = new Event(type, { bubbles: true, cancelable: true });
      const at = [{ identifier: 1, target: el, clientX: x, clientY: y }];
      Object.defineProperty(e, 'touches', { value: type === 'touchend' ? [] : at });
      Object.defineProperty(e, 'changedTouches', { value: at });
      el.dispatchEvent(e);
    }
  }, steps);
}

/** A finger pulling the element down by `by` pixels (scrolling up). */
export async function pull(target: Locator, by: number) {
  const r = (await target.boundingBox())!;
  const x = r.x + 50;
  const y = r.y + 40;
  await finger(target, [{ type: 'touchstart', x, y }, { type: 'touchmove', x, y: y + by }, { type: 'touchend', x, y: y + by }]);
}

/** A finger swiping the element left from its right edge. */
export async function swipeLeft(target: Locator) {
  const r = (await target.boundingBox())!;
  const y = r.y + 20;
  await finger(target, [{ type: 'touchstart', x: r.x + r.width - 20, y }, { type: 'touchend', x: r.x + r.width - 160, y }]);
}

/** A finger swiping the element right from its left edge. */
export async function swipeRight(target: Locator) {
  const r = (await target.boundingBox())!;
  const y = r.y + 20;
  await finger(target, [{ type: 'touchstart', x: r.x + 20, y }, { type: 'touchend', x: r.x + 160, y }]);
}
