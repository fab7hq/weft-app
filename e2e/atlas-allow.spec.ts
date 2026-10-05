// Allowing a device (M8.1–M8.4, D8.1, D8.2): the machine asks and only it can
// answer; refused says why, and Your machines is the way on.
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { FakeMachine, atlas } from './fake-machine';
import { person, signIn } from './seed';

async function asked(page: Page, context: BrowserContext) {
  const machine = await FakeMachine.start();
  Object.assign(machine, atlas());
  machine.allowAtOnce = false;
  await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
  await page.goto('/');
  await expect.poll(() => machine.of('pair').length).toBe(1);
  machine.send({ type: 'asking' });
  return machine;
}

test('M8.1 D8.1: the machine asks, and the page says where to answer', async ({ page, context }) => {
  const machine = await asked(page, context);
  const where = page.viewportSize()!.width >= 768 ? 'browser' : 'phone';
  await expect(page.getByRole('heading', { name: `Allow this ${where} on your machine` })).toBeVisible();
  await expect(page.locator('.lede')).toHaveText('Go to studio and press Y.');
  await expect(page.getByText(where === 'phone' ? 'It waits two minutes. Nothing on this phone can answer it.' : 'It waits two minutes. Nothing here can answer it.')).toBeVisible();
  await expect(page.getByText('Asking', { exact: true })).toBeVisible();
  // Y on the machine: it is allowed, and the tree opens.
  machine.send({ type: 'paired', token: 't_good' });
  await expect(page.getByRole('treeitem', { name: 'weft', exact: true })).toBeVisible();
  await machine.close();
});

const REFUSALS = [
  { id: 'M8.2 D8.2', code: 'denied', said: 'Your machine said no to this device.' },
  { id: 'M8.3', code: 'expired', said: 'Nobody answered on your machine in two minutes.' },
  { id: 'M8.4', code: 'not_owner', said: 'This machine belongs to another account.' },
  { id: 'M8.4 busy', code: 'busy', said: 'Your machine was asked too often. Try again in a few minutes.' },
  { id: 'M8.4 fallback', code: 'what', said: 'Your machine refused this device.' },
];

for (const r of REFUSALS) {
  test(`${r.id}: refused says why, never retries, and Your machines is the way on`, async ({ page, context }) => {
    const machine = await asked(page, context);
    machine.send({ type: 'refused', code: r.code });
    await expect(page.getByRole('heading', { name: 'Not allowed' })).toBeVisible();
    await expect(page.getByText(r.said)).toBeVisible();
    await page.waitForTimeout(1500);
    expect(machine.of('pair')).toHaveLength(1);
    await page.getByRole('button', { name: 'Your machines' }).click();
    await expect(page.getByRole('heading', { name: 'Your machines' })).toBeVisible();
    await machine.close();
  });
}
