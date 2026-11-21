// A confirmation is a bar, Cancel beside Send (M4.6–M4.7, D4.6–D4.7); its head names
// the project and agent it types into, as 17.2 does.
import { expect, test } from '@playwright/test';
import { FakeMachine, atlas } from './fake-machine';
import { person, signIn } from './seed';

const CLAUDE = '3f9a1c07b2de-0';
const CODEX = '3f9a1c07b2de-1';

/** Each card: what the machine stages, and what the bar says of it. */
const CARDS = [
  { id: 'M4.6 D4.6', agent: CODEX, what: 'Ready to send', why: 'This is the exact wording. Weft will not change it.', sends: 'ask_3',
    text: 'Implement /health: read BUILD_NUMBER from the environment at startup; fall back to "unknown".', into: null, said: ['This is the exact wording. Weft will not change it.'] },
  { id: 'M4.7 D4.7', agent: CODEX, what: 'Ready to send', sends: 'ask_3', why: 'This is the exact wording. Weft will not change it.\ncodex asked you about this and never got an answer, so it is still waiting. Sending it records your yes first.',
    text: 'Implement /health: read BUILD_NUMBER …', into: null, said: ['This is the exact wording. Weft will not change it.', 'codex asked you about this and never got an answer, so it is still waiting. Sending it records your yes first.'] },
];

for (const card of CARDS) {
  test(`${card.id}: the bar says what, where, why and exactly what; Send says yes, Cancel no`, async ({ page, context }) => {
    for (const [press, yes] of [['Send', true], ['Cancel', false]] as const) {
      const machine = await FakeMachine.start();
      Object.assign(machine, atlas());
      machine.onAct = (m) => [
        { type: 'pending', id: 'pnd_1', agent: card.agent, what: card.what, why: card.why, text: card.text, sends: card.sends ?? null },
        { type: 'ok', req: m.req, pending: 'pnd_1' },
      ];
      await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
      await page.goto('/');
      await page.getByRole('treeitem', { name: 'fix login', exact: true }).click();
      // The tree's bar: on a desktop the work's Details, open beside it, has its own Eval too.
      await page.locator('.tree-acts').getByRole('button', { name: 'Eval', exact: true }).click();
      const bar = page.getByRole('dialog', { name: card.what });
      await expect(bar).toBeVisible();
      // A send names no agent in its head: SEND TO says where it goes, the agent that wrote it to start with.
      if (card.into) await expect(bar.getByText(card.into, { exact: true })).toBeVisible();
      else await expect(bar.getByRole('button', { name: /^SEND TO / })).toHaveAccessibleName('SEND TO weft · codex wrote it');
      await expect(bar.locator('.pending-why')).toHaveText(card.said);
      await expect(bar.getByText(/^Weft will type/)).toHaveCount(0);
      expect(await bar.locator('pre').textContent()).toBe(card.text);
      await bar.getByRole('button', { name: press, exact: true }).click();
      await expect.poll(() => machine.of('resolve')).toEqual([expect.objectContaining({ pending: 'pnd_1', yes })]);
      await expect(bar).toHaveCount(0);
      await machine.close();
    }
  });
}

test('M4.6 D4.6: SEND TO on a send: the agent that wrote it on top and picked; another agent goes as `to`, a new one as `start`', async ({ page, context }) => {
  for (const [pick, where] of [
    ['weft · claude', { to: CLAUDE }],
    ['claude', { start: 'claude' }],
  ] as const) {
    const machine = await FakeMachine.start();
    Object.assign(machine, atlas());
    machine.onAct = (m) => [
      { type: 'pending', id: 'pnd_1', agent: CODEX, what: 'Ready to send', why: 'This is the exact wording. Weft will not change it.', text: 'Implement /health.', sends: 'ask_3' },
      { type: 'ok', req: m.req, pending: 'pnd_1' },
    ];
    await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
    await page.goto('/');
    await page.getByRole('treeitem', { name: 'fix login', exact: true }).click();
    await page.locator('.tree-acts').getByRole('button', { name: 'Eval', exact: true }).click();
    const bar = page.getByRole('dialog', { name: 'Ready to send' });
    await bar.getByRole('button', { name: /^SEND TO / }).click();
    const list = bar.getByRole('listbox', { name: 'SEND TO' });
    await expect(list.getByRole('option')).toHaveText([
      'weft · codexwrote it', 'weft · claude', 'weft · codex', 'claude', 'codex',
    ]);
    await expect(list.getByRole('option', { selected: true })).toHaveText('weft · codexwrote it');
    await list.getByRole('option', { name: pick, exact: true }).click();
    await bar.getByRole('button', { name: 'Send', exact: true }).click();
    await expect.poll(() => machine.of('resolve')).toEqual([expect.objectContaining({ pending: 'pnd_1', yes: true, ...where })]);
    await machine.close();
  }
});
