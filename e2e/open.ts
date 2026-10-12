// Moving about the app as a person does, on a phone or a desktop.
import { expect, type Page } from '@playwright/test';

export const wideOf = (page: Page) => page.viewportSize()!.width >= 768;

/** What names the open agent: its tab on a desktop, the header's name on a phone. */
export const shown = (page: Page) =>
  wideOf(page) ? page.getByRole('navigation', { name: 'Tabs' }).locator('[aria-current="page"]') : page.locator('.agent-name');

/** A row of the tree, by its name. */
export const row = (page: Page, name: string | RegExp) => page.getByRole('treeitem', { name, exact: typeof name === 'string' }).first();

/**
 * Open a running session's agent from the tree: on a desktop a click on its
 * row (D11.1); on a phone › to its session, then Go to its agent (M11.1, M11.5).
 */
export async function openAgent(page: Page, name: string | RegExp) {
  const r = row(page, name);
  if (wideOf(page)) await r.click();
  else {
    await r.getByRole('button', { name: /^Details of/ }).click();
    await page.getByRole('button', { name: 'Go to its agent', exact: true }).click();
  }
  await expect(page.getByLabel("The agent's screen")).toBeVisible();
}
