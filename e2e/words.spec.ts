// words.json is the language pack: replaced on the server, the next load shows the new word.
import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { FakeMachine, atlas } from './fake-machine';
import { person, signIn } from './seed';

const served = 'web/dist/words.json';

test('a replaced words.json shows its word after a reload', async ({ page, context }) => {
  const machine = await FakeMachine.start();
  Object.assign(machine, atlas());
  await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
  await page.goto('/');
  const fix = page.getByRole('treeitem', { name: 'fix login', exact: true });
  await expect(fix).toContainText('waiting · ASKED');

  const kept = readFileSync(served, 'utf8');
  try {
    writeFileSync(served, JSON.stringify({ ...JSON.parse(kept), 'web.turn.waiting': 'waiting on you' }));
    // The dev server notices the file within a moment, as a deploy would replace it.
    await expect.poll(async () => (await (await page.request.get('/words.json')).json())['web.turn.waiting']).toBe('waiting on you');
    await page.reload();
    await expect(fix).toContainText('waiting on you · ASKED');
  } finally {
    writeFileSync(served, kept);
    await machine.close();
  }
});
