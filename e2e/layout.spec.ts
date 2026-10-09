// Step 39: a tablet has the desktop's layout, the list beside the agent.
import { expect, test } from '@playwright/test';
import { FakeMachine, agent } from './fake-machine';
import { openAgent } from './open';
import { person, signIn } from './seed';

test('a tablet shows the list beside the agent', async ({ page, context }) => {
  const machine = await FakeMachine.start();
  machine.agents = [agent(0, 'weft', 'claude-code', 'waiting')];
  await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
  await page.goto('/');
  await openAgent(page, 'claude-code · no Ask yet');
  await expect(page.getByRole('navigation', { name: 'Work' })).toBeVisible();
  await expect(page.getByLabel("The agent's screen")).toBeVisible();
  await machine.close();
});
