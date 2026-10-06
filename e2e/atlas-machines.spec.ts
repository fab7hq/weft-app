// Your machines (M1.6, D1.6): a machine comes off the account with Remove and a
// confirmation over the page on a desktop, or a swipe left and Remove on a phone.
import { expect, test } from '@playwright/test';
import { person, signIn } from './seed';

test('M1.6 D1.6: a machine is removed from the account, and stays removed', async ({ page, context }, info) => {
  await signIn(context, person('octo', [{ name: 'studio' }, { name: 'laptop' }, { name: 'build-box' }]));
  await page.goto('/');
  const list = page.getByRole('list', { name: 'Your machines' });
  await expect(list.getByRole('listitem')).toHaveCount(3);
  const laptop = list.getByRole('listitem').filter({ hasText: 'laptop' });
  if (info.project.name === 'desktop') {
    const sure = page.getByRole('dialog', { name: 'Remove laptop from your account?' });
    // Cancel, Esc and a click outside each keep the machine.
    await laptop.getByRole('button', { name: 'Remove', exact: true }).click();
    await expect(sure).toBeVisible();
    await expect(sure).toContainText('laptop leaves this list. Weft on laptop is not touched; it joins again with W → R.');
    await expect(laptop.getByRole('button')).toHaveText(['laptophas not reported an address yet', 'Remove']);
    await sure.getByRole('button', { name: 'Cancel' }).click();
    await expect(sure).toHaveCount(0);
    await laptop.getByRole('button', { name: 'Remove', exact: true }).click();
    await expect(sure).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(sure).toHaveCount(0);
    await laptop.getByRole('button', { name: 'Remove', exact: true }).click();
    await expect(sure).toBeVisible();
    await page.mouse.click(20, 20);
    await expect(sure).toHaveCount(0);
    await expect(list.getByRole('listitem')).toHaveCount(3);
    await laptop.getByRole('button', { name: 'Remove', exact: true }).click();
    await sure.getByRole('button', { name: 'Remove', exact: true }).click();
  } else {
    await expect(laptop.getByRole('button', { name: 'Remove' })).toHaveCount(0);
    await laptop.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const t = (x: number) => [new Touch({ identifier: 1, target: el, clientX: x, clientY: r.y + 20 })];
      el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: t(r.right - 20), changedTouches: t(r.right - 20) }));
      el.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: t(r.right - 160) }));
    });
    await laptop.getByRole('button', { name: 'Remove' }).tap();
  }
  await expect(list.getByRole('listitem')).toHaveCount(2);
  await expect(list.getByText('laptop')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('list', { name: 'Your machines' }).getByRole('listitem')).toHaveCount(2);
});
