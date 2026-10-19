// Settings › RingFrame and › Harnesses on a device (M9.10, M9.11, D9.10,
// D9.11): the practices, the core rules per phase, every rule with where it
// comes from, what Eval judges must not do and a preview; each harness with
// how RingFrame sends to it and its route rules. Every project's, changed on
// the machine at once.
import { useEffect, useState } from 'preact/hooks';
import * as m from '../machine';
import { domainName, withDeny, withRule } from '../settings';
import { fill, w } from '../words';

const BASE = 'practices/software-development';
type Catalog = { catalog: string; render?: { core_cap?: number }; entries: Record<string, unknown>[] };
type Rules = { domains: { domain: string; base: boolean; description?: string }[]; catalogs: Catalog[]; judges?: { deny: string[]; from: string }; refused?: string };
type Preview = { text?: string; kept?: number; left_out?: number; refused?: string };

/** What a read shows until RingFrame answers: that it is asked, or why RingFrame would not say. */
function unanswered(r: { refused?: unknown } | null): string {
  return r?.refused ? fill('desktop.settings.refused', { why: String(r.refused) }) : w('desktop.settings.asking');
}

type Supported = { harness: string; title: string; version?: string | null; verified: string | null; mark: string; state: string };

/** Every harness this Weft supports and how each stands, as the machine says. */
function useSupported(project: string): Supported[] | null {
  const [supported, setSupported] = useState<Supported[] | null>(null);
  useEffect(() => {
    void m.readSettings(project, 'harnesses', '').then((r) => setSupported(Array.isArray(r) ? (r as Supported[]) : null));
  }, [project]);
  return supported;
}

/** RingFrame's rules through the machine, asked again whenever its settings change. */
function useRules(project: string): Rules | null {
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

/** How many rules show before "N more". */
const FIRST_RULES = 4;

/** Qualified or candidate, as two halves of one control (a host's rule). */
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

/** One rule on one line: its name, its wording (wide), where it comes from and
 * its tier, a host's status, on or off, and Edit or Reset. Edit, or the name
 * on a phone, opens its wording, tier, tasks and concerns. */
function RuleRow({ project, catalog, e, mine }: { project: string; catalog: string; e: Record<string, unknown>; mine: unknown }) {
  const [open, setOpen] = useState(false);
  const id = String(e.id);
  const changed = e.source !== 'shipped';
  const put = (field: string | null, value: unknown) => set(project, ['deltas', catalog, 'entries'], withRule(mine, id, field, value));
  const host = catalog !== BASE;
  const list = (v: unknown) => (Array.isArray(v) ? v.join(', ') : '');
  const source = w(changed ? 'desktop.settings.changed' : 'desktop.settings.shipped');
  const said = host ? (changed ? source : '') : `${source} · ${String(e.tier ?? 'core')}`;
  return (
    <div class={`rf-row rf-rule${changed ? ' rf-row--changed' : ''}`}>
      <button class="rf-name" type="button" onClick={() => setOpen(!open)}>
        <span>{String(e.label ?? id)}</span>
        {said && <span class={`rf-said rf-said--under${changed ? ' rf-said--changed' : ''}`}>{said}</span>}
      </button>
      <span class="rf-text">{String(e.text ?? '')}</span>
      {said && <span class={`rf-said rf-said--beside${changed ? ' rf-said--changed' : ''}`}>{said}</span>}
      {host && <Status on={String(e.status ?? 'candidate')} put={(v) => put('status', v)} />}
      <Switch id={`rule-${catalog}-${id}`} on={e.enabled !== false} flip={() => put('enabled', e.enabled === false)} />
      {changed ? (
        <button class="rf-link" type="button" onClick={() => put(null, null)}>{w('act.reset')}</button>
      ) : (
        <button class="rf-link" type="button" onClick={() => setOpen(!open)}>{w('desktop.settings.edit')}</button>
      )}
      {open && (
        <div class="settings-edit rf-edit">
          <label>{w('desktop.settings.wording')}<Typed value={String(e.text ?? '')} keep={(v) => put('text', v || null)} /></label>
          {!host && (
            <label>{w('desktop.settings.tier')}
              <select class="settings-select" value={String(e.tier ?? 'core')} onChange={(ev) => put('tier', (ev.target as HTMLSelectElement).value)}>
                <option value="core">core</option>
                <option value="situational">situational</option>
              </select>
            </label>
          )}
          {!host && <label>{w('desktop.settings.applies_to')}<Typed value={list(e.applies_to)} keep={(v) => put('applies_to', v ? v.split(',').map((s) => s.trim()).filter(Boolean) : null)} /></label>}
          {!host && <label>{w('desktop.settings.concerns')}<Typed value={list(e.concerns)} keep={(v) => put('concerns', v ? v.split(',').map((s) => s.trim()).filter(Boolean) : null)} /></label>}
          {changed && <button class="rf-link rf-link--phone" type="button" onClick={() => put(null, null)}>{w('act.reset')}</button>}
        </div>
      )}
    </div>
  );
}

/** A section's label, with its one act on the right. */
function Head({ label, act, onAct }: { label: string; act?: string; onAct?: () => void }) {
  return (
    <div class="rf-head">
      <span class="fab7-group">{label}</span>
      {act && <button class="rf-link" type="button" onClick={onAct}>{act}</button>}
    </div>
  );
}

const ROUTES = ['native_plan', 'native_goal', 'native_direct'];
const TASKS = ['implement', 'plan', 'review', 'diagnose'];

export function RingFrameTab({ project }: { project: string }) {
  const rules = useRules(project);
  const supported = useSupported(project);
  const s = m.settings.value[project];
  const layer = (s?.machine?.ringframe ?? {}) as Record<string, unknown>;
  const [preview, setPreview] = useState<Preview | null>(null);
  const [shown, setShown] = useState(false);
  const [all, setAll] = useState(false);
  const [adding, setAdding] = useState<'rule' | 'deny' | null>(null);
  const [denyOpen, setDenyOpen] = useState<number | null>(null);
  const [pick, setPick] = useState(['', 'native_plan', 'implement']);
  const hosts = (rules?.catalogs ?? []).filter((c) => !c.catalog.startsWith('practices/')).map((c) => c.catalog);
  const host = pick[0] || hosts[0] || '';
  const unit = `${host}|${pick[1]}|${pick[2]}`;
  // What the preview keeps, said beside Show; its text once shown.
  useEffect(() => {
    setPreview(null);
    if (host) void m.readSettings(project, 'preview', unit).then((r) => setPreview(r as Preview | null));
  }, [project, unit]);
  if (!rules?.catalogs) return <p class="settings-sub">{unanswered(rules)}</p>;
  const base = rules.catalogs.find((c) => c.catalog === BASE);
  const entries = ((layer.deltas as Record<string, { entries?: unknown }> | undefined)?.[BASE]?.entries) as unknown;
  const deny = (layer.eval as { deny?: string[] } | undefined)?.deny;
  // Nothing set: RingFrame's own list, each line changed from there.
  const listed = deny ?? rules.judges?.deny ?? [];
  const title = (h: string) => supported?.find((x) => x.harness === h)?.title ?? h;
  const own = (base?.entries ?? []).filter((e) => String(e.id).startsWith('own.')).length;
  const ruleList = base?.entries ?? [];
  const folded = !all && ruleList.length > FIRST_RULES + 1;
  const kept = preview && !preview.refused
    ? fill('web.settings.preview_kept', { kept: String(preview.kept ?? 0), left_out: String(preview.left_out ?? 0) })
    : unanswered(preview);
  return (
    <div class="rf">
      <Head label={w('desktop.settings.practices')} />
      {rules.domains.filter((d) => !d.base).map((d) => {
        const on = Boolean((layer.deltas as Record<string, unknown> | undefined)?.[`practices/${d.domain}`]);
        return (
          <label key={d.domain} for={`practice-${d.domain}`} class="rf-row">
            <span class="rf-name">{domainName(d.domain)}</span>
            <span class="rf-text">{d.description ?? ''}</span>
            <Switch id={`practice-${d.domain}`} on={on} flip={() => set(project, ['deltas', `practices/${d.domain}`], on ? null : { domain: d.domain })} />
          </label>
        );
      })}
      <div class="rf-row">
        <span class="rf-name">{w('desktop.settings.core_cap')}</span>
        <span class="rf-text">{w('desktop.settings.core_cap_what')}</span>
        <select class="settings-select rf-small" value={String(base?.render?.core_cap ?? 5)} onChange={(e) => set(project, ['deltas', BASE, 'render', 'core_cap'], Number((e.target as HTMLSelectElement).value))}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
      <Head label={fill('desktop.settings.rules', { practice: domainName('software-development') })} act={w('desktop.settings.add_rule')} onAct={() => setAdding(adding === 'rule' ? null : 'rule')} />
      {adding === 'rule' && (
        <div class="rf-row">
          <Typed value="" placeholder={w('desktop.settings.wording')} keep={(v) => (setAdding(null), v && set(project, ['deltas', BASE, 'entries'], withRule(entries, `own.${own + 1}`, 'text', v)))} />
        </div>
      )}
      {(folded ? ruleList.slice(0, FIRST_RULES) : ruleList).map((e) => <RuleRow key={String(e.id)} project={project} catalog={BASE} e={e} mine={entries} />)}
      {folded && (
        <button class="rf-row rf-more" type="button" onClick={() => setAll(true)}>
          <span class="rf-name">{fill('web.settings.more_rules', { n: String(ruleList.length - FIRST_RULES) })}</span>
        </button>
      )}
      <Head label={w('desktop.settings.judges')} act={w('desktop.settings.add')} onAct={() => setAdding(adding === 'deny' ? null : 'deny')} />
      {adding === 'deny' && (
        <div class="rf-row">
          <Typed value="" placeholder={w('desktop.settings.judges')} keep={(v) => (setAdding(null), v && set(project, ['eval', 'deny'], withDeny(listed, '+', v)))} />
        </div>
      )}
      {listed.map((line, i) => (
        <div key={i} class="rf-row rf-deny">
          <button class="rf-name" type="button" onClick={() => setDenyOpen(denyOpen === i ? null : i)}>
            <span>{line}</span>
            {deny === undefined && <span class="rf-said rf-said--under">{w('desktop.settings.shipped')}</span>}
          </button>
          {deny === undefined && <span class="rf-said rf-said--beside">{w('desktop.settings.shipped')}</span>}
          <span class={`rf-link rf-chevron${denyOpen === i ? ' rf-chevron--open' : ''}`} aria-hidden="true">›</span>
          <button class={`rf-link rf-remove${denyOpen === i ? ' rf-remove--open' : ''}`} type="button" onClick={() => set(project, ['eval', 'deny'], withDeny(listed, i, null))}>{w('desktop.settings.remove')}</button>
        </div>
      ))}
      <div class="rf-preview">
        <span class="rf-preview-name">{w('desktop.settings.preview')}</span>
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
      <div class="settings-foot rf-foot--phone"><p>{w('web.ringframe.foot')}</p></div>
    </div>
  );
}

export function HarnessesTab({ project }: { project: string }) {
  const rules = useRules(project);
  const supported = useSupported(project);
  const [shown, setShown] = useState<string | null>(null);
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const catalogs = (rules?.catalogs ?? []).filter((c) => !c.catalog.startsWith('practices/'));
  // Every harness this Weft supports; the route catalogs alone until the machine says.
  const list: Supported[] = supported ?? catalogs.map((c) => ({ harness: c.catalog, title: c.catalog, verified: null, mark: '', state: '' }));
  const host = shown ?? list.find((h) => catalogs.some((c) => c.catalog === h.harness))?.harness ?? null;
  useEffect(() => {
    setProfile(null);
    if (host) void m.readSettings(project, 'profile', host).then((r) => setProfile(r as Record<string, unknown> | null));
  }, [project, host]);
  if (!rules?.catalogs) return <p class="settings-sub">{unanswered(rules)}</p>;
  const layer = (m.settings.value[project]?.machine?.ringframe ?? {}) as { deltas?: Record<string, { entries?: unknown }> };
  const caps = (profile?.capabilities ?? []) as Record<string, unknown>[];
  const mark = (x: string) => (x === '✓' ? 'rf-mark--ok' : x === '↑' ? 'rf-mark--behind' : 'rf-mark--no');
  return (
    <div class="rf">
      {list.map((h) => {
        const open = h.harness === host;
        const catalog = catalogs.find((c) => c.catalog === h.harness);
        return (
          <div key={h.harness}>
            <button class={`rf-row rf-harness${open ? ' rf-harness--open' : ''}`} type="button" onClick={() => setShown(h.harness)}>
              <span class={`rf-mark ${mark(h.mark)}`}>{h.mark}</span>
              <span class="rf-name">
                <span>{h.title}</span>
                {open && (h.version || h.verified) && (
                  <span class="rf-said">{[h.version, h.verified && fill('desktop.harness.verified', { version: h.verified })].filter(Boolean).join(' · ')}</span>
                )}
              </span>
              <span class="rf-said rf-state">{`${h.state} ${open ? '⌄' : '›'}`}</span>
            </button>
            {open && (
              <div class="rf-open">
                <Head label={w('desktop.harness.sends')} />
                {!profile?.capabilities && <p class="settings-sub">{unanswered(profile)}</p>}
                {caps.map((cap) => (
                  <div key={String(cap.id)} class="rf-row">
                    <span class="rf-name">
                      <span>{w(`desktop.harness.${String(cap.id)}`)}</span>
                      <span class="rf-said rf-said--under">{typeof cap.max_prompt_chars === 'number' ? fill('desktop.harness.limit', { n: String(cap.max_prompt_chars) }) : String(cap.selection ?? '')}</span>
                    </span>
                    <span class="rf-text">{typeof cap.max_prompt_chars === 'number' ? fill('desktop.harness.limit', { n: String(cap.max_prompt_chars) }) : String(cap.selection ?? '')}</span>
                    <span class="rf-said">{w(cap.delivery_mode === 'human_handoff' ? 'desktop.harness.you_send' : 'desktop.harness.weft_sends')}</span>
                  </div>
                ))}
                {catalog && <Head label={fill('desktop.harness.route_rules', { harness: h.title })} />}
                {catalog?.entries.map((e) => <RuleRow key={String(e.id)} project={project} catalog={catalog.catalog} e={e} mine={layer.deltas?.[catalog.catalog]?.entries} />)}
              </div>
            )}
          </div>
        );
      })}
      <div class="settings-foot"><p>{fill('web.harness.foot', { machine: m.current.value?.name ?? '' })}</p></div>
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
