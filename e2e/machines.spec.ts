// Signed out, signed in with no machine, one, several.
import { expect, test } from '@playwright/test';
import { person, signIn } from './seed';

test('signed out, it offers GitHub', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'The agents on your working machine, from here.' })).toBeVisible();
  const signIn = page.getByRole('link', { name: 'Sign in with GitHub' });
  await expect(signIn).toHaveAttribute('href', '/auth/github');
  await expect(page.getByRole('link', { name: 'What Fab7 keeps' })).toHaveAttribute('href', '/privacy');
});

test('signed in with no machine, it says how to add one', async ({ page, context }) => {
  await signIn(context, person('octo', []));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Add a machine' })).toBeVisible();
  await expect(page.getByText('Signed in as octo')).toBeVisible();
  await expect(page.getByText('Press R for Remote')).toBeVisible();
});

test('signed in with one machine, it opens that machine', async ({ page, context }) => {
  await signIn(context, person('octo', [{ name: 'studio' }]));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'studio', level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: /Your machines/ })).toHaveCount(0);
});

test('signed in with several, it lists them and opens the one picked', async ({ page, context }) => {
  await signIn(context, person('octo', [{ name: 'studio' }, { name: 'laptop' }, { name: 'build-box' }]));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Your machines' })).toBeVisible();
  const machines = page.getByRole('list', { name: 'Your machines' }).getByRole('button');
  await expect(machines).toHaveText([/studio/, /laptop/, /build-box/]);
  await machines.nth(1).click();
  await expect(page.getByRole('heading', { name: 'laptop', level: 1 })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Your machines' })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/');
});
