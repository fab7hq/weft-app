// What is still coming, and a read that failed: where content will be, said
// the same way on every screen, the viewer's too.
import { w } from '../words';

/** Breathing lines where content will be, never "none yet". */
export function Coming({ lines = [85, 95, 60] }: { lines?: number[] }) {
  return (
    <div class="wait-coming" aria-busy="true">
      {lines.map((at, i) => <span key={i} class="wait-line" style={{ width: `${at}%` }} />)}
    </div>
  );
}

/** A read that failed: why, in amber, where its content would be, and Try again. */
export function ReadFailed({ text, again }: { text: string; again: () => void }) {
  return (
    <div class="wait-failed" role="alert">
      <span class="wait-failed-text">{text}</span>
      <button class="tree-act wait-again" type="button" onClick={again}>{w('wait.try_again')}</button>
    </div>
  );
}
