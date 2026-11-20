// Files an Eval should skip: the findings under the Eval dialog's Reads row
// (17.28), a project's settings section (9.13, 9.14), and an Eval's "Not
// read" (11.16). Each finding shows its path, what it holds, the exact line
// that keeps it out and one button; nothing is written until it is pressed.
import { Fragment } from 'preact';
import { useState } from 'preact/hooks';
import * as m from '../machine';
import { addedLabel, findingWhat, fixLabel, inSettings, left, lineWords, noLongerRead, notRead, type Finding, type Fix, type NotRead } from '../skip';
import { w } from '../words';
import { Dot } from './Wait';

/** A finding's line, as it is written into its file: on a phone it wraps only at its spaces. */
function Line({ fix }: { fix: Fix }) {
  return (
    <div class="skip-line">
      <span class="skip-file">{fix.file}</span>
      <code class="skip-code">{lineWords(fix.line).map((word, i) => <Fragment key={i}>{i > 0 && ' '}<span class="skip-word">{word}</span></Fragment>)}</code>
    </div>
  );
}

/** One finding: found (amber, its line and its button), taken (teal), or a nested repository (muted, nothing to take). */
function Row({ f, take, busy }: { f: Finding; take: ((fix: Fix) => void) | null; busy: boolean }) {
  if (f.kind === 'sub_repo') {
    return (
      <div class="skip-row skip-row--sub">
        <span class="skip-mark" aria-hidden="true">○</span>
        <div class="skip-body">
          <div class="skip-what"><span class="skip-path">{f.path}</span>{' '}{findingWhat(f)}</div>
        </div>
      </div>
    );
  }
  if (f.added) {
    return (
      <div class="skip-row skip-row--added">
        <span class="skip-mark" aria-hidden="true">✓</span>
        <div class="skip-body">
          <div class="skip-what">
            <span class="skip-added">{addedLabel(f.fix)}</span>{' '}
            <span class="skip-about">
              {'· '}
              <span class="skip-path skip-added-path">{f.path}</span>
              {f.fix && <span class="skip-path skip-added-line">{f.fix.line}</span>}
              <span class="skip-gone-sep">{' — '}</span>
              <span class="skip-gone">{noLongerRead(f)}</span>
            </span>
          </div>
          {f.fix && <Line fix={f.fix} />}
        </div>
      </div>
    );
  }
  return (
    <div class="skip-row">
      <span class="skip-mark" aria-hidden="true">■</span>
      <div class="skip-body">
        <div class="skip-what"><span class="skip-path">{f.path}</span>{' '}<span class="skip-about"><span class="skip-dash">{'— '}</span>{findingWhat(f)}</span></div>
        {f.fix && <Line fix={f.fix} />}
      </div>
      {f.fix && take && (
        <button class="skip-take" type="button" aria-busy={busy || undefined} onClick={() => take(f.fix!)}>{busy && <Dot />}{fixLabel(f.fix)}</button>
      )}
    </div>
  );
}

/** Take a finding's line: one at a time; what the machine would not do stays said until the next press. */
function useTake(project: string | null): [take: ((fix: Fix) => void) | null, busy: string | null, refused: string | null] {
  const [busy, setBusy] = useState<string | null>(null);
  const [refused, setRefused] = useState<string | null>(null);
  if (!project) return [null, busy, refused];
  const take = (fix: Fix) => {
    if (busy) return;
    setBusy(fix.line);
    setRefused(null);
    void m.addSkip(project, fix).then((why) => {
      setBusy(null);
      setRefused(why);
    });
  };
  return [take, busy, refused];
}

/** The Eval dialog's findings, under its Reads row (17.28): those taken first, in teal, and how many are left. */
export function CheckBeforeReads({ findings, project }: { findings: Finding[]; project: string | null }) {
  const [take, busy, refused] = useTake(project);
  if (findings.length === 0) return null;
  const count = left(findings);
  return (
    <div class="skip-check" role="group" aria-label={w('skip.check_before')}>
      <div class="skip-check-head">
        <span class="skip-check-title">{w('skip.check_before')}</span>
        {count && <span class="skip-check-left">{count}</span>}
      </div>
      <div class="skip-list skip-list--dialog">
        {findings.map((f) => <Row key={`${f.kind}:${f.path}`} f={f} take={take} busy={busy !== null && busy === f.fix?.line} />)}
      </div>
      {refused && <p class="pending-why ask-hint" role="alert">{refused}</p>}
    </div>
  );
}

/** A project's settings section (9.13): every finding with its line and button, and Check again; none, a quiet ✓ (9.14). */
export function SkipSection({ project }: { project: string }) {
  const [take, busy, refused] = useTake(project);
  const [checking, setChecking] = useState(false);
  const [unchecked, setUnchecked] = useState<string | null>(null);
  const said = m.skips.value[project];
  const findings = said ? inSettings(said) : null;
  const again = () => {
    if (checking) return;
    setChecking(true);
    setUnchecked(null);
    void m.checkSkip(project).then((why) => {
      setChecking(false);
      setUnchecked(why);
    });
  };
  return (
    <section class="skip-section" aria-label={w('skip.title')}>
      <div class="skip-head">
        <span class="skip-head-title">{w('skip.title')}</span>
        <button class="skip-again" type="button" aria-busy={checking || undefined} onClick={again}>{checking && <Dot />}{w('skip.check_again')}</button>
      </div>
      {findings && findings.length === 0 && (
        <div class="skip-none" role="status">
          <span class="skip-mark" aria-hidden="true">✓</span>
          <span>{w('skip.none')}</span>
        </div>
      )}
      {findings && findings.length > 0 && (
        <div class="skip-list skip-list--settings">
          {findings.map((f) => <Row key={`${f.kind}:${f.path}`} f={f} take={take} busy={busy !== null && busy === f.fix?.line} />)}
        </div>
      )}
      {(refused || unchecked) && <p class="settings-sub ask-hint skip-refused" role="alert">{refused ?? unchecked}</p>}
    </section>
  );
}

/** What an Eval counted and did not read, by kind and folder (11.16). */
export function NotReadSection({ rows }: { rows: NotRead[] }) {
  const said = notRead(rows);
  if (!said) return null;
  return (
    <section class="nr" aria-label={w('not_read.title')}>
      <div class="nr-head">
        <span class="nr-title">{w('not_read.title')}</span>
        <span class="nr-total">{`· ${said.total}`}</span>
      </div>
      {said.rows.map((r) => (
        <div key={r.kind} class="nr-row">
          <span class="nr-count">{r.count}</span>
          <span class="nr-where">
            {r.where.map((f, i) => <span key={f}>{i > 0 && ' · '}<span class="nr-path">{f}</span></span>)}
            {r.more && ` ${r.more}`}
          </span>
        </div>
      ))}
    </section>
  );
}
