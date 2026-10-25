// What a mark on a closed Eval offers and sends. The machine says which items
// take which mark (`marks` in the Eval view): "I asked for this" on a change
// the judges left unexplained or split on, "Not what I meant" on a
// requirement. Mark opens the machine's one dialog, which names the item.

export type Mark = 'asked_for' | 'not_meant';

/** The mark `item` takes, by its window or step id; none when it takes none. */
export const markOf = (marks: Record<string, Mark> | undefined, item: string): Mark | null => marks?.[item] ?? null;

/** The words of a mark's button and of its dialog's title. */
export const markWords = (mark: Mark): string => `eval_view.${mark}`;

/** What a mark sends: the Eval and its item; the machine shows the dialog. */
export function markMessage(project: string, evalId: string, item: string): Record<string, unknown> {
  return { act: 'mark', project, eval: evalId, text: item };
}
