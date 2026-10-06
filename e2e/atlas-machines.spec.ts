// Your machines (M1.6, D1.6): a machine comes off the account with Remove on a
// desktop, or a swipe left and Remove on a phone, then Proceed in the
// confirmation over the page.
import { expect, test } from '@playwright/test';
import { swipeLeft } from './touch';
import { person, signIn } from './seed';

test('M1.6 D1.6: a machine is removed from the account, and stays removed', async ({ page, context }, info) => {
  await signIn(context, person('octo', [{ name: 'studio' }, { name: 'laptop' }, { name: 'build-box' }]));
  await page.goto('/');
  const list = page.getByRole('list', { name: 'Your machines' });
  await expect(list.getByRole('listitem')).toHaveCount(3);
  const laptop = list.getByRole('listitem').filter({ hasText: 'laptop' });
  const sure = page.getByRole('dialog', { name: 'Remove laptop from your account?' });
  const remove = () => (info.project.name === 'desktop' ? laptop.getByRole('button', { name: 'Remove', exact: true }).click() : swipeRemove());
  // On a phone Remove shows only once the row is swiped left; it stays shown after Cancel.
  const swipeRemove = async () => {
    if (await laptop.getByRole('button', { name: 'Remove' }).isVisible()) return laptop.getByRole('button', { name: 'Remove' }).tap();
    await swipeLeft(laptop);
    await laptop.getByRole('button', { name: 'Remove' }).tap();
  };
  // Remove asks first, on every size; Cancel, Esc and a press outside each keep the machine.
  if (info.project.name !== 'desktop') await expect(laptop.getByRole('button', { name: 'Remove' })).toHaveCount(0);
  await remove();
  await expect(sure).toBeVisible();
  await expect(sure).toContainText('laptop leaves this list. Weft on laptop is not touched; it joins again with W → R.');
  await sure.getByRole('button', { name: 'Cancel' }).click();
  await expect(sure).toHaveCount(0);
  if (info.project.name === 'desktop') {
    await expect(laptop.getByRole('button')).toHaveText(['laptophas not reported an address yet', 'Remove']);
    await remove();
    await expect(sure).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(sure).toHaveCount(0);
    await remove();
    await expect(sure).toBeVisible();
    await page.mouse.click(20, 20);
    await expect(sure).toHaveCount(0);
  }
  await expect(list.getByRole('listitem')).toHaveCount(3);
  await remove();
  await sure.getByRole('button', { name: 'Proceed' }).click();
  await expect(list.getByRole('listitem')).toHaveCount(2);
  await expect(list.getByText('laptop')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('list', { name: 'Your machines' }).getByRole('listitem')).toHaveCount(2);
});
