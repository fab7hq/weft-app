// A confirmation is a bar, Cancel beside Send (M4.5–M4.10, D4.5–D4.10).
import { expect, test } from '@playwright/test';
import { FakeMachine, atlas } from './fake-machine';
import { person, signIn } from './seed';

const CLAUDE = '3f9a1c07b2de-0';
const CODEX = '3f9a1c07b2de-1';
const GATHERED = "Weft has gathered the change. The agent will run RingFrame's\njudging tasks on it; none of the judges did the work.";

/** Each card: what the machine stages, and what the bar says of it. */
const CARDS = [
  { id: 'M4.5 D4.5', agent: CLAUDE, what: 'Ready to ask claude', why: 'Weft will type  /rf:ask  into claude.\nThe agent will ask you which approach to take, in its own pane.',
    text: 'Read the build number from the environment and show it on /health', into: 'into claude', said: ['The agent will ask you which approach to take, in its own pane.'] },
  { id: 'M4.6 D4.6', agent: CODEX, what: 'Ready to send to codex', why: 'This is the exact wording. Weft will not change it.',
    text: 'Implement /health: read BUILD_NUMBER from the environment at startup; fall back to "unknown".', into: 'into codex', said: ['This is the exact wording. Weft will not change it.'] },
  { id: 'M4.7 D4.7', agent: CODEX, what: 'Ready to send to codex', why: 'This is the exact wording. Weft will not change it.\ncodex asked you about this and never got an answer, so it is still waiting. Sending it records your yes first.',
    text: 'Implement /health: read BUILD_NUMBER …', into: 'into codex', said: ['This is the exact wording. Weft will not change it.', 'codex asked you about this and never got an answer, so it is still waiting. Sending it records your yes first.'] },
  { id: 'M4.8 D4.8', agent: CODEX, what: 'Eval this work?', why: `Weft will type  /rf:eval debate evl_2  into codex.\n${GATHERED}`,
    text: '/rf:eval debate evl_2 coverage contract', into: 'into codex', said: ["Weft has gathered the change. The agent will run RingFrame's judging tasks on it; none of the judges did the work."] },
  { id: 'M4.9 D4.9', agent: CODEX, what: 'Seal this work?', why: 'Weft will type  /rf:seal evl_2  into codex.\nThe agent will ask what you decided, and write a receipt.',
    text: '/rf:seal evl_2', into: 'into codex', said: ['The agent will ask what you decided, and write a receipt.'] },
  { id: 'M4.10 D4.10', agent: CLAUDE, what: 'Eval this work?', why: `Weft will type  /rf:eval debate evl_2  into claude.\n${GATHERED}\nclaude did not do this work. Both acts read the record.`,
    text: '/rf:eval debate evl_2 coverage contract', into: 'into claude', said: ["Weft has gathered the change. The agent will run RingFrame's judging tasks on it; none of the judges did the work.", 'claude did not do this work. Both acts read the record.'] },
];

for (const card of CARDS) {
  test(`${card.id}: the bar says what, where, why and exactly what; Send says yes, Cancel no`, async ({ page, context }) => {
    for (const [press, yes] of [['Send', true], ['Cancel', false]] as const) {
      const machine = await FakeMachine.start();
      Object.assign(machine, atlas());
      machine.onAct = (m) => [
        { type: 'pending', id: 'pnd_1', agent: card.agent, what: card.what, why: card.why, text: card.text },
        { type: 'ok', req: m.req, pending: 'pnd_1' },
      ];
      await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
      await page.goto('/');
      await page.getByRole('treeitem', { name: 'health endpoint', exact: true }).click();
      await page.getByRole('button', { name: 'Eval', exact: true }).click();
      const bar = page.getByRole('dialog', { name: card.what });
      await expect(bar).toBeVisible();
      await expect(bar.getByText(card.into, { exact: true })).toBeVisible();
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
