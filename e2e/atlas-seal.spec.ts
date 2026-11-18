// The Seal's questions (17.4, 17.5): read as the Seal opens, one at a time,
// each answered before the next, a review of every answer with the decision,
// and only there Seal, which sends the answers with it. Picking sends nothing.
// An Eval that asked nothing keeps the Seal in the bar's place, as before.
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { FakeMachine, atlas } from './fake-machine';
import { person, signIn } from './seed';

const QUESTIONS = [
  {
    id: 'q1', ask: 'did_you_want',
    behaviour: 'The sign-in page remembers the last email address typed on this device.',
    why: 'You weren’t sure last time, so it’s asked again.',
    asked_before: { decision: 'sel_1/d1', seal: 'sel_1', date: '2026-11-10' },
  },
  { id: 'q2', ask: 'what_did_you_mean', behaviour: 'What you meant by “show an error”.' },
];

async function opened(page: Page, context: BrowserContext, questions: unknown[]) {
  const machine = await FakeMachine.start();
  const sample = atlas();
  sample.reads.questions = { ask_3: questions };
  Object.assign(machine, sample);
  machine.onAct = (m) => [{ type: 'ok', req: m.req }];
  await signIn(context, person('octo', [{ name: 'studio', address: machine.address }]));
  await page.goto('/');
  await expect(page.locator('.tree-acts').getByRole('button', { name: 'Ask', exact: true })).toBeVisible();
  await page.getByRole('treeitem', { name: 'health endpoint', exact: true }).first().click();
  await page.locator('.tree-acts').getByRole('button', { name: 'Seal', exact: true }).click();
  return machine;
}

const reads = (machine: FakeMachine) => machine.of('read').filter((m) => m.what === 'questions');

test('17.4 17.5: the Seal asks its Eval\'s questions one at a time, then reviews every answer, and only then seals', async ({ page, context }) => {
  const machine = await opened(page, context, QUESTIONS);
  const dialog = page.getByRole('dialog', { name: 'Seal health endpoint' });
  await expect(dialog).toBeVisible();
  await expect.poll(() => reads(machine)).toEqual([expect.objectContaining({ unit: 'ask_3' })]);

  // Question 1 of 2: where it comes from, the behaviour, why, what it asks.
  await expect(dialog).toContainText('Question 1 of 2');
  await expect(dialog.locator('.seal-before')).toHaveText('Asked before · not sure on 10 Nov');
  await expect(dialog.locator('.seal-behaviour')).toHaveText(QUESTIONS[0].behaviour);
  await expect(dialog.locator('.seal-label')).toHaveText('Did you want this?');
  const answers = dialog.getByRole('radiogroup', { name: 'Did you want this?' });
  await expect(answers.getByRole('radio')).toHaveText(['I wanted this', 'Not wanted', 'Not sure']);

  // Next waits for an answer; an answer picked sends nothing.
  const next = dialog.getByRole('button', { name: 'Next', exact: true });
  await next.click();
  await expect(dialog).toContainText('Question 1 of 2');
  await answers.getByRole('radio', { name: 'Not wanted' }).click();
  await expect(answers.getByRole('radio', { name: 'Not wanted' })).toHaveAttribute('aria-checked', 'true');
  // Not wanted fills with amber, a decision and never an error.
  await expect(answers.getByRole('radio', { name: 'Not wanted' })).toHaveCSS('background-color', 'rgb(210, 153, 34)');
  expect(machine.of('act')).toHaveLength(0);
  await next.click();

  // The person's own words, or Not sure.
  await expect(dialog).toContainText('Question 2 of 2');
  await expect(dialog.locator('.seal-label')).toHaveText('What did you mean?');
  await next.click();
  await expect(dialog).toContainText('Question 2 of 2');
  await dialog.getByRole('textbox', { name: 'Your own words' }).fill('A short message under the field, in red.');
  await expect(dialog.getByRole('button', { name: 'Seal', exact: true })).toHaveCount(0);
  await next.click();

  // The review: every answer in its colour, each with Change.
  await expect(dialog).toContainText('All 2 answered');
  await expect(dialog.getByRole('heading', { name: 'Your answers' })).toBeVisible();
  const pills = dialog.locator('.seal-pill');
  await expect(pills).toHaveText(['Not wanted', '“A short message under the field, in red.”']);
  await expect(pills.nth(0)).toHaveCSS('color', 'rgb(237, 187, 91)');
  await expect(pills.nth(1)).toHaveCSS('color', 'rgb(88, 166, 255)');

  // Change goes back to that question, its answer kept.
  await dialog.getByRole('button', { name: `Change: ${QUESTIONS[0].behaviour}` }).click();
  await expect(dialog).toContainText('Question 1 of 2');
  await expect(answers.getByRole('radio', { name: 'Not wanted' })).toHaveAttribute('aria-checked', 'true');
  await answers.getByRole('radio', { name: 'I wanted this' }).click();
  await next.click();
  await expect(dialog.getByRole('textbox', { name: 'Your own words' })).toHaveValue('A short message under the field, in red.');
  await next.click();
  await expect(pills.nth(0)).toHaveText('I wanted this');
  await expect(pills.nth(0)).toHaveCSS('color', 'rgb(57, 197, 187)');

  // The decision in its colour, the reason in the decision's.
  const decision = dialog.getByRole('radiogroup', { name: 'Decision' });
  await decision.getByRole('radio', { name: 'Rejected' }).click();
  await expect(decision.getByRole('radio', { name: 'Rejected' })).toHaveCSS('background-color', 'rgb(248, 81, 73)');
  const why = dialog.getByRole('radiogroup', { name: 'Why' });
  await why.getByRole('radio', { name: 'Not what I asked' }).click();
  await expect(why.getByRole('radio', { name: 'Not what I asked' })).toHaveCSS('color', 'rgb(248, 81, 73)');
  expect(machine.of('act')).toHaveLength(0);

  await dialog.getByRole('button', { name: 'Seal', exact: true }).click();
  await expect.poll(() => machine.of('act')).toEqual([expect.objectContaining({
    act: 'seal', unit: 'ask_3', text: 'rejected',
    draft: {
      reason: 'not_what_i_asked',
      answers: [
        { question: 'q1', answer: 'wanted', ms: expect.any(Number) },
        { question: 'q2', answer: 'words', words: 'A short message under the field, in red.', ms: expect.any(Number) },
      ],
    },
  })]);
  await expect(dialog).toHaveCount(0);
  expect(reads(machine)).toHaveLength(1);
  await machine.close();
});

test('17.4: Not sure counts as an answer', async ({ page, context }) => {
  const machine = await opened(page, context, [QUESTIONS[1]]);
  const dialog = page.getByRole('dialog', { name: 'Seal health endpoint' });
  await dialog.getByRole('radio', { name: 'Not sure' }).click();
  await dialog.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(dialog.locator('.seal-pill')).toHaveText(['Not sure']);
  await dialog.getByRole('button', { name: 'Seal', exact: true }).click();
  await expect.poll(() => machine.of('act')).toEqual([expect.objectContaining({
    act: 'seal', text: 'accepted', draft: { answers: [{ question: 'q2', answer: 'not_sure', ms: expect.any(Number) }] },
  })]);
  await machine.close();
});

test('an Eval that asked nothing keeps the Seal in the bar\'s place, with no answers to send', async ({ page, context }) => {
  const machine = await opened(page, context, []);
  const seal = page.getByRole('dialog', { name: 'Seal this work?' });
  await expect(seal.getByRole('button', { name: 'Seal', exact: true })).toBeVisible();
  await expect(page.locator('.seal-asks')).toHaveCount(0);
  await expect(seal.getByRole('radio', { name: 'Accepted' })).toHaveCSS('background-color', 'rgb(57, 197, 187)');
  await seal.getByRole('button', { name: 'Seal', exact: true }).click();
  await expect.poll(() => machine.of('act')).toEqual([expect.objectContaining({ act: 'seal', unit: 'ask_3', text: 'accepted' })]);
  expect(machine.of('act')[0].draft).toBeUndefined();
  await machine.close();
});
