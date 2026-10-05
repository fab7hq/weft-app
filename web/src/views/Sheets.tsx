// What Weft will type, exactly, before it types it (web-app.md §7).
import type * as m from '../machine';

export function ConfirmSheet({ pending, answered, onAnswer }: { pending: m.Pending; answered: boolean; onAnswer: (yes: boolean) => void }) {
  return (
    <div class="sheet-backdrop">
      <div class="fab7-sheet" role="dialog" aria-label={pending.what}>
        <h2 class="fab7-sheet__title">{pending.what}</h2>
        <p class="fab7-sheet__why">{pending.why}</p>
        <pre class="fab7-sheet__text">{pending.text}</pre>
        {answered ? (
          <p class="note" role="status">Answered on the machine</p>
        ) : (
          <div class="fab7-sheet__actions">
            <button class="fab7-button fab7-button--secondary" type="button" onClick={() => onAnswer(false)}>No</button>
            <button class="fab7-button" type="button" onClick={() => onAnswer(true)}>Yes, type it</button>
          </div>
        )}
      </div>
    </div>
  );
}
