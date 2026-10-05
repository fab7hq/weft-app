// The bar says the machine's why in sentences, without "Weft will type … into …".
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { use } from '../src/words';
import { why } from '../src/bar';

use(JSON.parse(readFileSync('web/public/words.json', 'utf8')));

describe('the bar', () => {
  it('joins the lines the TUI wraps and drops what the header and box show', () => {
    const evaluating = "Weft will type  /rf:eval debate evl_2  into codex.\nWeft has gathered the change. The agent will run RingFrame's\njudging tasks on it; none of the judges did the work.";
    expect(why(evaluating)).toEqual(["Weft has gathered the change. The agent will run RingFrame's judging tasks on it; none of the judges did the work."]);
    const asking = 'Weft will type  /rf:ask  into claude.\nThe agent will ask you which approach to take, in its own pane.';
    expect(why(asking)).toEqual(['The agent will ask you which approach to take, in its own pane.']);
    const waiting = 'This is the exact wording. Weft will not change it.\ncodex asked you about this and never got an answer, so it is still waiting. Sending it records your yes first.';
    expect(why(waiting)).toHaveLength(2);
  });
});
