// "Not what I meant" on a sentence of a closed Eval's Ask: the one mark a
// person makes. A change takes none; nobody is asked about a file. Its
// button opens the machine's one dialog, which shows the sentence.

/** The button's words. */
export const NOT_MEANT = 'eval_view.not_meant';

/** What the button sends: the Eval and the sentence's id; the machine shows the dialog. */
export function markMessage(project: string, evalId: string, sentence: string): Record<string, unknown> {
  return { act: 'mark', project, eval: evalId, text: sentence };
}
