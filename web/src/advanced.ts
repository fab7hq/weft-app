// Advanced settings: off unless the person turns it on, kept per browser. On,
// every Settings section shows its expert controls in place.
import { signal } from '@preact/signals';

const KEPT = 'weft.advanced';

export const advanced = signal(((): boolean => {
  try {
    return localStorage.getItem(KEPT) === 'on';
  } catch {
    return false;
  }
})());

export function flipAdvanced(): void {
  advanced.value = !advanced.value;
  try {
    localStorage.setItem(KEPT, advanced.value ? 'on' : 'off');
  } catch {
    // Not kept: off again next time.
  }
}
