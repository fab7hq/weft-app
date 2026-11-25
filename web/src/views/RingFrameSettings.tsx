// Settings' Rules, Agent apps and what Eval never does (19.3–19.8): the
// practices and their rules, each harness and how it stands, and, with
// Advanced settings on, the cap, the tiers, the preview, how Weft asks each
// harness and its own rules. Every project's, changed on the machine at once.
// And a project's own RingFrame changes (M9.12).
import { useEffect, useState } from 'preact/hooks';
import { advanced } from '../advanced';
import * as m from '../machine';
import { type JudgeEval, domainName, isPractice, practicesOn, withDeny, withRule } from '../settings';
import { fill, w } from '../words';
import { Asking } from './Wait';

const BASE = 'practices/software-development';
type Catalog = { catalog: string; render?: { core_cap?: number }; entries: Record<string, unknown>[] };
type Rules = { domains: { domain: string; base: boolean; description?: string }[]; catalogs: Catalog[]; judges?: { deny: string[]; from: string }; refused?: string };
type Preview = { text?: string; kept?: number; left_out?: number; refused?: string };

/** What a read shows until RingFrame answers: that it is asked, or why RingFrame would not say. */
function unanswered(r: { refused?: unknown } | null): preact.ComponentChildren {
  return r?.refused ? <span class="ask-hint">{fill('desktop.settings.refused', { why: String(r.refused) })}</span> : <Asking words={w('desktop.settings.asking')} />;
}

export type Supported = { harness: string; title: string; version?: string | null; verified: string | null; mark: string; state: string; eval?: JudgeEval | null };

/** Every harness this Weft supports and how each stands, as the machine says. */
export function useSupported(project: string): Supported[] | null {
  const [supported, setSupported] = useState<Supported[] | null>(null);
  useEffect(() => {
    void m.readSettings(project, 'harnesses', '').then((r) => setSupported(Array.isArray(r) ? (r as Supported[]) : null));
  }, [project]);
  return supported;
}

/** RingFrame's rules through the machine, asked again whenever its settings change. */
export function useRules(project: string): Rules | null {
  const [rules, setRules] = useState<Rules | null>(null);
  const said = m.settings.value[project];
  useEffect(() => {
    void m.readSettings(project, 'rules', 'machine').then((r) => setRules(r as Rules | null));
  }, [project, said]);
  return rules;
}

/** Set every project's RingFrame setting at `key` (under `ringframe`). */
function set(project: string, key: string[], value: unknown) {
  void m.setSetting(project, 'machine', ['ringframe', ...key], value ?? null);
}

function Switch({ id, on, flip }: { id: string; on: boolean; flip: () => void }) {
  return (
    <span class="switch">
      <input id={id} type="checkbox" checked={on} onChange={flip} class="switch-input" />
      <span class="switch-track" aria-hidden="true"><span class="switch-knob" /></span>
    </span>
  );
}

/** A text kept on Enter or leaving: a rule's wording, its tasks, a line judges must not do. */
function Typed({ value, keep, placeholder }: { value: string; keep: (v: string) => void; placeholder?: string }) {
  const [typed, setTyped] = useState(value);
  useEffect(() => setTyped(value), [value]);
  return (
    <input class="settings-input" value={typed} placeholder={placeholder} onInput={(e) => setTyped((e.target as HTMLInputElement).value)}
      onBlur={() => typed.trim() !== value && keep(typed.trim())} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
  );
}

/** How many rules a group shows before "N more". */
const FIRST_RULES = 4;

/** Qualified or candidate, as two halves of one control (a harness's rule). */
function Status({ on, put }: { on: string; put: (v: string) => void }) {
  return (
    <span class="rf-status" role="group">
      {(['qualified', 'candidate'] as const).map((v) => (
        <button key={v} type="button" class={`rf-status-half${on === v ? ' rf-status-half--on' : ''}`} aria-pressed={on === v} onClick={() => put(v)}>
          {w(`desktop.harness.${v}`)}
        </button>
      ))}
    </span>
  );
}

/** One rule: its name and wording, Reset once changed, and on or off. The name
 * opens its wording to edit. With Advanced settings on it also says a
 * practice's rule's tier, a harness's rule's status, and Edit. */
function RuleRow({ project, catalog, e, mine }: { project: string; catalog: string; e: Record<string, unknown>; mine: unknown }) {
  const [open, setOpen] = useState(false);
  const id = String(e.id);
  const changed = e.source !== 'shipped';
  const put = (field: string | null, value: unknown) => set(project, ['deltas', catalog, 'entries'], withRule(mine, id, field, value));
  const host = !isPractice(catalog);
  const more = advanced.value;
  const list = (v: unknown) => (Array.isArray(v) ? v.join(', ') : '');
  const said = [changed ? w('desktop.settings.changed') : '', more && !host ? String(e.tier ?? 'core') : ''].filter(Boolean).join(' · ');
  return (
    <div class={`set-rule${open ? ' set-rule--open' : ''}`}>
      <button class="set-rule-name" type="button" onClick={() => setOpen(!open)}>
        <span>{String(e.label ?? id)}</span>
        <span class="set-rule-text">{String(e.text ?? '')}</span>
      </button>
      {said && <span class={`set-tag${changed ? ' set-tag--changed' : ''}`}>{said}</span>}
      {host && more && <Status on={String(e.status ?? 'candidate')} put={(v) => put('status', v)} />}
      {changed ? (
        <button class="rf-link" type="button" onClick={() => put(null, null)}>{w('act.reset')}</button>
      ) : (
        more && <button class="rf-link" type="button" onClick={() => setOpen(!open)}>{w('desktop.settings.edit')}</button>
      )}
      <Switch id={`rule-${catalog}-${id}`} on={e.enabled !== false} flip={() => put('enabled', e.enabled === false)} />
      {open && (
        <div class="settings-edit set-rule-edit">
          <label>{w('desktop.settings.wording')}<Typed value={String(e.text ?? '')} keep={(v) => put('text', v || null)} /></label>
          {more && !host && (
            <label>{w('desktop.settings.tier')}
              <select class="settings-select" value={String(e.tier ?? 'core')} onChange={(ev) => put('tier', (ev.target as HTMLSelectElement).value)}>
                <option value="core">core</option>
                <option value="situational">situational</option>
              </select>
            </label>
          )}
          {more && !host && <label>{w('desktop.settings.applies_to')}<Typed value={list(e.applies_to)} keep={(v) => put('applies_to', v ? v.split(',').map((s) => s.trim()).filter(Boolean) : null)} /></label>}
          {more && !host && <label>{w('desktop.settings.concerns')}<Typed value={list(e.concerns)} keep={(v) => put('concerns', v ? v.split(',').map((s) => s.trim()).filter(Boolean) : null)} /></label>}
        </div>
      )}
    </div>
  );
}

/** A section's label, marked when only Advanced settings shows it, with its one act on the right. */
export function Head({ label, act, onAct, more = false }: { label: string; act?: string; onAct?: () => void; more?: boolean }) {
  return (
    <div class="rf-head">
      <span class="fab7-group">{label}{more && <span class="set-adv">{w('settings.advanced_mark')}</span>}</span>
      {act && <button class="rf-link" type="button" onClick={onAct}>{act}</button>}
    </div>
  );
}

/** A practice's own rule, typed and added to the practice picked (one is picked when only one is on). */
function AddRule({ project, groups, rules, deltas, first, done }: { project: string; groups: string[]; rules: Rules; deltas: Deltas; first: string; done: () => void }) {
  const [into, setInto] = useState(first);
  const keep = (text: string) => {
    done();
    if (!text) return;
    const own = (rules.catalogs.find((c) => c.catalog === into)?.entries ?? []).filter((e) => String(e.id).startsWith('own.')).length;
    set(project, ['deltas', into, 'entries'], withRule(deltas?.[into]?.entries, `own.${own + 1}`, 'text', text));
  };
  return (
    <div class="set-add">
      {groups.length > 1 && (
        <select class="settings-select" value={into} aria-label={w('settings.rules.work_on')} onChange={(ev) => setInto((ev.target as HTMLSelectElement).value)}>
          {groups.map((c) => <option key={c} value={c}>{practiceName(c)}</option>)}
        </select>
      )}
      <Typed value="" placeholder={w('desktop.settings.wording')} keep={keep} />
    </div>
  );
}

type Deltas = Record<string, { entries?: unknown; render?: { core_cap?: number } } | null> | undefined;

const practiceName = (catalog: string) => domainName(catalog.replace(/^practices\//, ''));

/** How many of a practice's rules are on, as its group says. */
function onOf(listed: Catalog | undefined): string {
  const all = listed?.entries ?? [];
  return fill('settings.rules.on', { on: String(all.filter((e) => e.enabled !== false).length), n: String(all.length) });
}

/** Rules (19.5, 19.6): what the person works on, and each practice's rules,
 * switched on and off. A desktop opens a practice's rules in place; a phone
 * opens one practice's page (`practice`). Advanced settings adds the core
 * rules per phase, each rule's tier and the preview. */
export function RulesSection({ project, wide, practice, openPractice }: { project: string; wide: boolean; practice?: string; openPractice: (catalog: string) => void }) {
  const rules = useRules(project);
  const layer = (m.settings.value[project]?.machine?.ringframe ?? {}) as { deltas?: Deltas };
  const [shown, setShown] = useState<string | null>(BASE);
  const [all, setAll] = useState(false);
  const [adding, setAdding] = useState(false);
  if (!rules?.catalogs) return <p class="settings-sub">{unanswered(rules)}</p>;
  const more = advanced.value;
  const deltas = layer.deltas;
  const on = practicesOn(rules.domains, deltas);
  const groups = [BASE, ...on.map((d) => `practices/${d}`)];
  const listed = (c: string) => rules.catalogs.find((x) => x.catalog === c);
  const ruleRows = (c: string, folded: boolean) => {
    const list = listed(c)?.entries ?? [];
    const cut = folded && !all && list.length > FIRST_RULES + 1;
    return (
      <>
        {(cut ? list.slice(0, FIRST_RULES) : list).map((e) => <RuleRow key={String(e.id)} project={project} catalog={c} e={e} mine={deltas?.[c]?.entries} />)}
        {cut && <button class="set-more" type="button" onClick={() => setAll(true)}>{fill('settings.rules.more', { n: String(list.length - FIRST_RULES) })}</button>}
      </>
    );
  };
  // A phone's page of one practice's rules.
  if (practice && !wide) {
    return (
      <div class="rf set-section">
        <Head label={onOf(listed(practice))} act={w('settings.rules.add')} onAct={() => setAdding(!adding)} />
        {adding && <AddRule project={project} groups={[practice]} rules={rules} deltas={deltas} first={practice} done={() => setAdding(false)} />}
        {ruleRows(practice, false)}
      </div>
    );
  }
  const base = listed(BASE);
  return (
    <div class="rf set-section">
      <p class="set-lede">{w('settings.rules_what')}</p>
      <Head label={w('settings.rules.work_on')} />
      {rules.domains.map((d) => {
        const turned = d.base || on.includes(d.domain);
        return d.base ? (
          <div key={d.domain} class="set-row">
            <span class="set-label"><span>{domainName(d.domain)}</span>{d.description && <span class="set-what">{d.description}</span>}</span>
            <span class="set-tag">{w('settings.rules.always_on')}</span>
          </div>
        ) : (
          <label key={d.domain} for={`practice-${d.domain}`} class="set-row">
            <span class="set-label"><span>{domainName(d.domain)}</span>{d.description && <span class="set-what">{d.description}</span>}</span>
            <Switch id={`practice-${d.domain}`} on={turned} flip={() => set(project, ['deltas', `practices/${d.domain}`], turned ? null : { domain: d.domain })} />
          </label>
        );
      })}
      {more && (
        <>
          <Head label={w('settings.rules.cap')} more />
          <div class="set-row">
            <span class="set-label"><span>{w('desktop.settings.core_cap')}</span><span class="set-what">{w('desktop.settings.core_cap_what')}</span></span>
            <select class="settings-select rf-small" aria-label={w('desktop.settings.core_cap')} value={String(base?.render?.core_cap ?? 5)} onChange={(e) => set(project, ['deltas', BASE, 'render', 'core_cap'], Number((e.target as HTMLSelectElement).value))}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </>
      )}
      <Head label={w('settings.rules.the_rules')} act={w('settings.rules.add')} onAct={() => setAdding(!adding)} />
      {adding && <AddRule project={project} groups={groups} rules={rules} deltas={deltas} first={shown ?? BASE} done={() => setAdding(false)} />}
      {groups.map((c) => {
        const open = wide && shown === c;
        return (
          <div key={c} class="set-group">
            <button class={`set-group-head${open ? ' set-group-head--open' : ''}`} type="button" aria-expanded={wide ? open : undefined}
              onClick={() => (wide ? (setShown(open ? null : c), setAll(false)) : openPractice(c))}>
              {wide && <span class="set-chev" aria-hidden="true">{open ? '⌄' : '›'}</span>}
              <span class="set-group-name">{practiceName(c)}</span>
              <span class="set-tag">{onOf(listed(c))}</span>
              {!wide && <span class="set-chev" aria-hidden="true">›</span>}
            </button>
            {open && <div class="set-group-rules">{ruleRows(c, true)}</div>}
          </div>
        );
      })}
      {more && <PromptPreview project={project} rules={rules} />}
    </div>
  );
}

/** The phone's summary of Rules: how many kinds of work are on. */
export function useRulesSummary(project: string): string {
  const rules = useRules(project);
  const layer = (m.settings.value[project]?.machine?.ringframe ?? {}) as { deltas?: Deltas };
  if (!rules?.domains) return '';
  const n = 1 + practicesOn(rules.domains, layer.deltas).length;
  return n === 1 ? w('settings.rules.kind') : fill('settings.rules.kinds', { n: String(n) });
}

const ROUTES = ['native_plan', 'native_goal', 'native_direct'];
const TASKS = ['implement', 'plan', 'review', 'diagnose'];

/** The prompt a harness's route and a task would carry, and what the cap left out (Advanced settings). */
function PromptPreview({ project, rules }: { project: string; rules: Rules }) {
  const supported = useSupported(project);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [shown, setShown] = useState(false);
  const [pick, setPick] = useState(['', 'native_plan', 'implement']);
  const hosts = rules.catalogs.filter((c) => !isPractice(c.catalog)).map((c) => c.catalog);
  const host = pick[0] || hosts[0] || '';
  const unit = `${host}|${pick[1]}|${pick[2]}`;
  useEffect(() => {
    setPreview(null);
    if (host) void m.readSettings(project, 'preview', unit).then((r) => setPreview(r as Preview | null));
  }, [project, unit]);
  const title = (h: string) => supported?.find((x) => x.harness === h)?.title ?? h;
  const kept = preview && !preview.refused
    ? fill('web.settings.preview_kept', { kept: String(preview.kept ?? 0), left_out: String(preview.left_out ?? 0) })
    : unanswered(preview);
  return (
    <>
      <div class="rf-preview">
        <span class="rf-preview-name">{w('desktop.settings.preview')}<span class="set-adv">{w('settings.advanced_mark')}</span></span>
        <select class="settings-select rf-pick" value={`${host}|${pick[1]}`} onChange={(e) => {
          const [h, r] = (e.target as HTMLSelectElement).value.split('|');
          setPick([h, r, pick[2]]);
        }}>
          {hosts.flatMap((h) => ROUTES.map((r) => <option key={`${h}|${r}`} value={`${h}|${r}`}>{`${title(h)} · ${w(`desktop.harness.${r}`)}`}</option>))}
        </select>
        <select class="settings-select rf-pick" value={pick[2]} onChange={(e) => setPick([pick[0], pick[1], (e.target as HTMLSelectElement).value])}>
          {TASKS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button class="rf-preview-show" type="button" onClick={() => setShown(!shown)}>
          <span class="rf-preview-title">{w('web.settings.preview_rules')}</span>
          <span class="rf-said">{kept}</span>
          <span class="rf-link">{`${w('desktop.settings.show')}`}</span>
        </button>
      </div>
      {shown && preview?.text && <pre class="settings-preview">{preview.text}</pre>}
    </>
  );
}

/** While reading, Eval never: RingFrame's own lines until changed, each with Remove; + Add types one. */
export function EvalNever({ project }: { project: string }) {
  const rules = useRules(project);
  const [adding, setAdding] = useState(false);
  const layer = (m.settings.value[project]?.machine?.ringframe ?? {}) as { eval?: { deny?: string[] } };
  const deny = layer.eval?.deny;
  // Nothing set: RingFrame's own list, each line changed from there.
  const listed = deny ?? rules?.judges?.deny ?? [];
  return (
    <div class="rf">
      <Head label={w('settings.eval.never')} act={w('desktop.settings.add')} onAct={() => setAdding(!adding)} />
      {adding && (
        <div class="set-add">
          <Typed value="" placeholder={w('settings.eval.never_new')} keep={(v) => (setAdding(false), v && set(project, ['eval', 'deny'], withDeny(listed, '+', v)))} />
        </div>
      )}
      {listed.map((line, i) => (
        <div key={i} class="set-row rf-deny">
          <span class="set-label"><span>{line}</span>{deny === undefined && <span class="set-tag set-tag--under">{w('settings.eval.built_in')}</span>}</span>
          {deny === undefined && <span class="set-tag set-tag--beside">{w('settings.eval.built_in')}</span>}
          <button class="rf-link" type="button" onClick={() => set(project, ['eval', 'deny'], withDeny(listed, i, null))}>{w('desktop.settings.remove')}</button>
        </div>
      ))}
    </div>
  );
}

/** What a mode does, in a line for people, and its limit when it has one. */
function modeSaid(cap: Record<string, unknown>): string {
  const limit = typeof cap.max_prompt_chars === 'number' ? fill('desktop.harness.limit', { n: String(cap.max_prompt_chars) }) : null;
  return [typeof cap.purpose === 'string' ? cap.purpose : null, limit].filter(Boolean).join(' · ');
}

/** How an agent app stands, in the person's words: its mark, its word, the
 * chip's colour, what to do when it needs something, and whether it needs you. */
export function standing(h: Supported): { mark: string; tone: 'ok' | 'warn' | 'no'; word: string; what?: string; needs: boolean } {
  if (h.mark === '✓') return { mark: '✓', tone: 'ok', word: w('settings.apps.ready'), needs: false };
  if (h.mark === '↑') return { mark: '■', tone: 'warn', word: w('settings.apps.update'), what: 'settings.apps.update_what', needs: true };
  if (h.state.toLowerCase() === 'not found') return { mark: '□', tone: 'no', word: w('settings.apps.missing'), what: 'settings.apps.missing_what', needs: false };
  if (h.state.toLowerCase() === 'not set up' || h.mark === '!') return { mark: '■', tone: 'warn', word: w('settings.apps.setup'), what: 'settings.apps.setup_what', needs: true };
  return { mark: h.mark, tone: 'no', word: h.state, needs: false };
}

/** The agent apps that need the person: how many, and the phone's summary of them. */
export function appsNeeding(list: Supported[] | null): { n: number; said: string } {
  const needing = (list ?? []).filter((h) => standing(h).needs);
  if (needing.length === 0) return { n: 0, said: '' };
  if (needing.length > 1) return { n: needing.length, said: fill('settings.apps.need', { n: String(needing.length) }) };
  return { n: 1, said: w(needing[0].mark === '↑' ? 'settings.apps.needs_update' : 'settings.apps.needs_setup') };
}

/** Agent apps (19.7, 19.8): each harness this Weft supports and how it
 * stands, with what to do when it needs something. Advanced settings opens
 * one: its version, how Weft asks it, and its own rules. */
export function AppsSection({ project, machine }: { project: string; machine: string }) {
  const rules = useRules(project);
  const supported = useSupported(project);
  const [shown, setShown] = useState<string | null>(null);
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const more = advanced.value;
  const catalogs = (rules?.catalogs ?? []).filter((c) => !isPractice(c.catalog));
  const list: Supported[] = supported ?? [];
  const host = more ? shown : null;
  useEffect(() => {
    setProfile(null);
    if (host) void m.readSettings(project, 'profile', host).then((r) => setProfile(r as Record<string, unknown> | null));
  }, [project, host]);
  if (!supported) return <p class="settings-sub"><Asking words={w('desktop.settings.asking')} /></p>;
  const layer = (m.settings.value[project]?.machine?.ringframe ?? {}) as { deltas?: Record<string, { entries?: unknown }> };
  const caps = (profile?.capabilities ?? []) as Record<string, unknown>[];
  return (
    <div class="rf set-section">
      <p class="set-lede">{fill('settings.apps_what', { machine })}</p>
      <Head label={fill('settings.apps.on', { machine })} />
      {list.map((h) => {
        const st = standing(h);
        const open = host === h.harness;
        const catalog = catalogs.find((c) => c.catalog === h.harness);
        const version = [h.version, h.verified && fill('desktop.harness.verified', { version: h.verified })].filter(Boolean).join(' · ');
        const Row = more ? 'button' : 'div';
        return (
          <div key={h.harness} class="set-app-block">
            <Row class={`set-app${open ? ' set-app--open' : ''}`} {...(more ? { type: 'button', 'aria-expanded': open, onClick: () => setShown(open ? null : h.harness) } : {})}>
              <span class={`set-mark set-mark--${st.tone}`} aria-hidden="true">{st.mark}</span>
              <span class="set-label">
                <span>{h.title}{more && version && <span class="set-version">{version}</span>}</span>
                {st.what && <span class="set-what">{fill(st.what, { machine })}</span>}
              </span>
              <span class={`set-chip set-chip--${st.tone}`}>{st.word}</span>
              {more && <span class="set-chev" aria-hidden="true">{open ? '⌄' : '›'}</span>}
            </Row>
            {open && (
              <div class="set-app-more">
                <Head label={w('settings.apps.asks')} more />
                {!profile?.capabilities && <p class="settings-sub">{unanswered(profile)}</p>}
                {caps.map((cap) => (
                  <div key={String(cap.id)} class="set-row set-row--mode">
                    <span class="set-route">{w(`desktop.harness.${String(cap.id)}`)}</span>
                    <span class="set-what">{modeSaid(cap)}</span>
                  </div>
                ))}
                {catalog && <Head label={w('settings.apps.rules')} more />}
                {catalog?.entries.map((e) => <RuleRow key={String(e.id)} project={project} catalog={catalog.catalog} e={e} mine={layer.deltas?.[catalog.catalog]?.entries} />)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** A project's own RingFrame changes (M9.12): the core rules per phase and
 * each rule it sets, beside every project's, with Reset; a rule or the cap
 * added from the choice under them. */
/** A project's rules and every project's, asked again whenever its settings change. */
export function useProjectRules(project: string): { here: Rules | null; every: Rules | null } {
  const [rules, setRules] = useState<{ here: Rules | null; every: Rules | null }>({ here: null, every: null });
  const said = m.settings.value[project];
  useEffect(() => {
    void Promise.all([m.readSettings(project, 'rules', 'project'), m.readSettings(project, 'rules', 'machine')]).then(([here, every]) =>
      setRules({ here: here as Rules | null, every: every as Rules | null }));
  }, [project, said]);
  return rules;
}

/** What RingFrame a project can still set for itself: the cap, each rule not set; `[value, words]`. */
export function ringFrameAddable(project: string, rules: { here: Rules | null }): [string, string][] {
  const layer = (m.settings.value[project]?.project?.ringframe ?? {}) as { deltas?: Record<string, { entries?: Record<string, unknown>[]; render?: { core_cap?: number } }> };
  const mine = layer.deltas?.[BASE]?.entries ?? [];
  const out: [string, string][] = [];
  if (layer.deltas?.[BASE]?.render?.core_cap === undefined) out.push(['ringframe:core_cap', w('desktop.settings.core_cap')]);
  for (const e of rules.here?.catalogs?.find((c) => c.catalog === BASE)?.entries ?? []) {
    if (!mine.some((x) => x.id === e.id)) out.push([`ringframe:${String(e.id)}`, `RingFrame · ${String(e.label ?? e.id)}`]);
  }
  return out;
}

export function ProjectRingFrame({ project, rules, adding, done }: { project: string; rules: { here: Rules | null; every: Rules | null }; adding: string | null; done: () => void }) {
  const said = m.settings.value[project];
  const layer = (said?.project?.ringframe ?? {}) as { deltas?: Record<string, { entries?: Record<string, unknown>[]; render?: { core_cap?: number } }>; eval?: { deny?: string[] } };
  const base = (r: Rules | null) => r?.catalogs?.find((c) => c.catalog === BASE);
  const here = base(rules.here);
  const every = base(rules.every);
  const mine = layer.deltas?.[BASE]?.entries ?? [];
  const cap = layer.deltas?.[BASE]?.render?.core_cap;
  const put = (key: string[], value: unknown) => void m.setSetting(project, 'project', ['ringframe', ...key], value ?? null);
  const said2 = (e: Record<string, unknown> | undefined) => `${String(e?.tier ?? 'core')}, ${e?.enabled === false ? 'off' : 'on'}`;
  const combos = ['core, on', 'core, off', 'situational, on', 'situational, off'];
  const shown = (here?.entries ?? []).filter((e) => mine.some((x) => x.id === e.id) || adding === String(e.id));
  return (
    <>
      {rules.here?.refused && <p class="settings-sub">{unanswered(rules.here)}</p>}
      {(cap !== undefined || adding === 'core_cap') && (
        <div class="settings-row settings-row--setting">
          <span class="settings-text"><span>{w('desktop.settings.core_cap')}</span><span class="settings-sub">{fill('desktop.project.every', { value: String(every?.render?.core_cap ?? 5) })}</span></span>
          <select class="settings-select" value={String(cap ?? '')} onChange={(e) => put(['deltas', BASE, 'render', 'core_cap'], Number((e.target as HTMLSelectElement).value))}>
            {cap === undefined && <option value="">—</option>}
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <button class="settings-reset" type="button" onClick={() => (done(), put(['deltas', BASE, 'render', 'core_cap'], null))}>{w('act.reset')}</button>
        </div>
      )}
      {shown.map((e) => {
        const id = String(e.id);
        const theirs = every?.entries.find((x) => x.id === id);
        return (
          <div key={id} class="settings-row settings-row--setting">
            <span class="settings-text"><span>{`RingFrame · ${String(e.label ?? id)}`}</span><span class="settings-sub">{fill('desktop.project.every', { value: said2(theirs) })}</span></span>
            <span class="settings-pick">
              <select class="settings-select" value={mine.some((x) => x.id === id) ? said2(e) : ''} onChange={(ev) => {
                const value = (ev.target as HTMLSelectElement).value;
                if (!value) return (done(), put(['deltas', BASE, 'entries'], withRule(mine, id, null, null)));
                const [tier, on] = value.split(', ');
                put(['deltas', BASE, 'entries'], withRule(withRule(mine, id, 'tier', tier), id, 'enabled', on === 'on'));
              }}>
                <option value="">{fill('desktop.project.every', { value: said2(theirs) })}</option>
                {combos.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </span>
            <button class="settings-reset" type="button" onClick={() => (done(), put(['deltas', BASE, 'entries'], withRule(mine, id, null, null)))}>{w('act.reset')}</button>
          </div>
        );
      })}
      {layer.eval?.deny && (
        <div class="settings-row settings-row--setting">
          <span class="settings-text"><span>{w('desktop.settings.judges')}</span><span class="settings-sub">{layer.eval.deny.join(' · ')}</span></span>
          <button class="settings-reset" type="button" onClick={() => put(['eval', 'deny'], null)}>{w('act.reset')}</button>
        </div>
      )}
    </>
  );
}
