// Step 38, web-app.md §8: a push from the machine shows, and a tap opens its
// agent. Headless Chromium has no push service: the subscription is a stub
// (the push service is the one thing mocked), and the push reaches the real
// service worker through Chromium's DevTools deliverPushMessage, the path a
// push service's delivery takes.
import { expect, test } from '@playwright/test';
import { FakeMachine, agent } from './fake-machine';
import { person, signIn } from './seed';

const VAPID = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';

test('notifications on: the subscription goes to the machine; its push shows and opens the agent', async ({ page, context }) => {
  const machine = await FakeMachine.start();
  machine.agents = [agent(0, 'weft', 'claude-code', 'working'), agent(1, 'docs', 'codex', 'waiting')];
  machine.vapid = VAPID;
  await context.grantPermissions(['notifications']);
  await context.addInitScript(() => {
    const fake = {
      endpoint: 'https://push.example/sub/1',
      toJSON: () => ({ endpoint: 'https://push.example/sub/1', keys: { p256dh: 'BPk', auth: 'au' } }),
      unsubscribe: async () => true,
    };
    PushManager.prototype.subscribe = async function () {
      return fake as unknown as PushSubscription;
    };
    PushManager.prototype.getSubscription = async function () {
      return null;
    };
  });
  await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
  await page.goto('/');
  await page.getByRole('button', { name: 'Weft ⌄' }).click();
  await page.getByLabel(/Notifications from studio/).click();
  await expect.poll(() => machine.of('push').length).toBe(1);
  expect(machine.of('push')[0]).toEqual({ type: 'push', subscription: { endpoint: 'https://push.example/sub/1', keys: { p256dh: 'BPk', auth: 'au' } } });
  await page.getByRole('button', { name: '‹ Back' }).click();

  // What weft remote sends (remote.md §10), delivered to the service worker.
  const cdp = await context.newCDPSession(page);
  const registrations: { registrationId: string; scopeURL: string }[] = [];
  cdp.on('ServiceWorker.workerRegistrationUpdated', (e) => registrations.push(...e.registrations));
  await cdp.send('ServiceWorker.enable');
  await expect.poll(() => registrations.length).toBeGreaterThan(0);
  const payload = { agent: '3f9a1c07b2de-1', title: 'Codex in docs', body: 'needs your input', count: 1 };
  await cdp.send('ServiceWorker.deliverPushMessage', {
    origin: 'http://localhost:8788',
    registrationId: registrations[0].registrationId,
    data: JSON.stringify(payload),
  });
  const [worker] = context.serviceWorkers();
  const shown = async () =>
    worker.evaluate(async () =>
      (await (self as unknown as ServiceWorkerGlobalScope).registration.getNotifications()).map((n) => ({ title: n.title, body: n.body, tag: n.tag })),
    );
  await expect.poll(shown).toEqual([{ title: 'Codex in docs', body: 'needs your input', tag: '3f9a1c07b2de-1' }]);

  // A tap: the agent opens.
  await worker.evaluate(async () => {
    const [n] = await (self as unknown as ServiceWorkerGlobalScope).registration.getNotifications();
    self.dispatchEvent(new NotificationEvent('notificationclick', { notification: n }));
  });
  await expect.poll(() => machine.of('watch').at(-1)).toEqual({ type: 'watch', agent: '3f9a1c07b2de-1' });
  await expect(page.getByRole('navigation', { name: 'Tabs' }).getByRole('button', { name: '2 codex' })).toHaveAttribute('aria-current', 'page');
  await machine.close();
});
