// Notifications on this device (web-app.md §8): turned on from a tap, after
// the Home Screen on iPhone and iPad; one subscription per machine, with
// that machine's own VAPID key.
import * as m from './machine';
import * as store from './store';

/** iPhone and iPad take a push only from the app added to the Home Screen. */
export function needsHomeScreen(): boolean {
  const ios = /iPhone|iPad/.test(navigator.userAgent);
  const standalone = (navigator as { standalone?: boolean }).standalone === true || matchMedia('(display-mode: standalone)').matches;
  return ios && !standalone;
}

function key(vapid: string): Uint8Array<ArrayBuffer> {
  const s = atob(vapid.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - (vapid.length % 4)) % 4));
  const out = new Uint8Array(new ArrayBuffer(s.length));
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/** Turn pushes on for this machine: why not, as a words key, if not. */
export async function turnOn(machine: string): Promise<string | null> {
  if (needsHomeScreen()) return 'web.push.home_screen';
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'web.push.unsupported';
  if (!m.vapid.value) return 'web.push.connect_first';
  if ((await Notification.requestPermission()) !== 'granted') return 'web.push.denied';
  const reg = await navigator.serviceWorker.ready;
  const old = await reg.pushManager.getSubscription();
  if (old) await old.unsubscribe();
  try {
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key(m.vapid.value) });
    if (!m.send({ type: 'push', subscription: sub.toJSON() })) return 'web.why.not_connected';
    const kept = (await store.get<store.Kept>('macs', machine)) ?? {};
    await store.set('macs', machine, { ...kept, push: true });
    return null;
  } catch {
    return 'web.push.failed';
  }
}

export async function turnOff(machine: string): Promise<void> {
  m.send({ type: 'push', subscription: null });
  const reg = await navigator.serviceWorker.ready;
  await (await reg.pushManager.getSubscription())?.unsubscribe();
  const kept = (await store.get<store.Kept>('macs', machine)) ?? {};
  await store.set('macs', machine, { ...kept, push: false });
}
