// words.json is the language pack: replaced on the server, the next load shows the new word.
import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { FakeMachine, agent } from './fake-machine';
import { person, signIn } from './seed';

const served = 'web/dist/words.json';

test('a replaced words.json shows its word after a reload', async ({ page, context }) => {
  const machine = await FakeMachine.start();
  machine.agents = [agent(0, 'weft', 'claude-code', 'waiting')];
  await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
  await page.goto('/');
  await expect(page.locator('.fab7-row__meta').first()).toHaveText('waiting for you');

  const kept = readFileSync(served, 'utf8');
  try {
    writeFileSync(served, JSON.stringify({ ...JSON.parse(kept), 'turn.waiting': 'waiting on you' }));
    // The dev server notices the file within a moment, as a deploy would replace it.
    await expect.poll(async () => (await (await page.request.get('/words.json')).json())['turn.waiting']).toBe('waiting on you');
    await page.reload();
    await expect(page.locator('.fab7-row__meta').first()).toHaveText('waiting on you');
  } finally {
    writeFileSync(served, kept);
    await machine.close();
  }
});
