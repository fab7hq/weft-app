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
type Rules = { domains: { domain: string; base: boolean; description?: string }[]; catalogs: Catalog[] };

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

/** One rule: where it comes from, its tier, on or off; Edit opens its wording,
 * tasks and concerns; Reset takes the change out. `field` names the status
 * a host's rule has instead of a tier. */
function RuleRow({ project, catalog, e, mine }: { project: string; catalog: string; e: Record<string, unknown>; mine: unknown }) {
  const [open, setOpen] = useState(false);
  const id = String(e.id);
  const changed = e.source !== 'shipped';
  const put = (field: string | null, value: unknown) => set(project, ['deltas', catalog, 'entries'], withRule(mine, id, field, value));
  const host = catalog !== BASE;
  const list = (v: unknown) => (Array.isArray(v) ? v.join(', ') : '');
  return (
    <div class={`settings-row settings-row--setting${changed ? ' settings-row--changed' : ''}`}>
      <span class="settings-text">
        <span>{String(e.label ?? id)}</span>
        <span class="settings-sub">{`${w(changed ? 'desktop.settings.changed' : 'desktop.settings.shipped')} · ${String(e.text ?? '')}`}</span>
        {open && (
          <span class="settings-edit">
            <label>{w('desktop.settings.wording')}<Typed value={String(e.text ?? '')} keep={(v) => put('text', v || null)} /></label>
            {!host && <label>{w('desktop.settings.applies_to')}<Typed value={list(e.applies_to)} keep={(v) => put('applies_to', v ? v.split(',').map((s) => s.trim()).filter(Boolean) : null)} /></label>}
            {!host && <label>{w('desktop.settings.concerns')}<Typed value={list(e.concerns)} keep={(v) => put('concerns', v ? v.split(',').map((s) => s.trim()).filter(Boolean) : null)} /></label>}
          </span>
        )}
      </span>
      {host ? (
        <select class="settings-select" value={String(e.status ?? 'candidate')} onChange={(ev) => put('status', (ev.target as HTMLSelectElement).value)}>
          <option value="qualified">{w('desktop.harness.qualified')}</option>
          <option value="candidate">{w('desktop.harness.candidate')}</option>
        </select>
      ) : (
        <select class="settings-select" value={String(e.tier ?? 'core')} onChange={(ev) => put('tier', (ev.target as HTMLSelectElement).value)}>
          <option value="core">core</option>
          <option value="situational">situational</option>
        </select>
      )}
      <Switch id={`rule-${catalog}-${id}`} on={e.enabled !== false} flip={() => put('enabled', e.enabled === false)} />
      {changed ? (
        <button class="settings-reset" type="button" onClick={() => put(null, null)}>{w('act.reset')}</button>
      ) : (
        <button class="settings-reset" type="button" onClick={() => setOpen(!open)}>{w('desktop.settings.edit')}</button>
      )}
    </div>
  );
}

export function RingFrameTab({ project }: { project: string }) {
  const rules = useRules(project);
  const s = m.settings.value[project];
  const layer = (s?.machine?.ringframe ?? {}) as Record<string, unknown>;
  const [preview, setPreview] = useState<string | null>(null);
  const [pick, setPick] = useState(['', 'native_plan', 'implement']);
  if (!rules) return <p class="settings-sub">{w('desktop.settings.asking')}</p>;
  const base = rules.catalogs.find((c) => c.catalog === BASE);
  const entries = ((layer.deltas as Record<string, { entries?: unknown }> | undefined)?.[BASE]?.entries) as unknown;
  const deny = (layer.eval as { deny?: string[] } | undefined)?.deny;
  const own = (base?.entries ?? []).filter((e) => String(e.id).startsWith('own.')).length;
  const hosts = rules.catalogs.filter((c) => !c.catalog.startsWith('practices/')).map((c) => c.catalog);
  const host = pick[0] || hosts[0] || '';
  return (
    <>
      <div class="fab7-group settings-group">{w('desktop.settings.practices')}</div>
      {rules.domains.filter((d) => !d.base).map((d) => {
        const on = Boolean((layer.deltas as Record<string, unknown> | undefined)?.[`practices/${d.domain}`]);
        return (
          <label key={d.domain} for={`practice-${d.domain}`} class="settings-row">
            <span class="settings-text"><span>{domainName(d.domain)}</span><span class="settings-sub">{d.description ?? ''}</span></span>
            <Switch id={`practice-${d.domain}`} on={on} flip={() => set(project, ['deltas', `practices/${d.domain}`], on ? null : { domain: d.domain })} />
          </label>
        );
      })}
      <div class="settings-row settings-row--setting">
        <span class="settings-text"><span>{w('desktop.settings.core_cap')}</span><span class="settings-sub">{w('desktop.settings.core_cap_what')}</span></span>
        <select class="settings-select" value={String(base?.render?.core_cap ?? 5)} onChange={(e) => set(project, ['deltas', BASE, 'render', 'core_cap'], Number((e.target as HTMLSelectElement).value))}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
      <div class="fab7-group settings-group">{fill('desktop.settings.rules', { practice: domainName('software-development') })}</div>
      {(base?.entries ?? []).map((e) => <RuleRow key={String(e.id)} project={project} catalog={BASE} e={e} mine={entries} />)}
      <div class="settings-row settings-row--setting">
        <Typed value="" placeholder={w('desktop.settings.add_rule')} keep={(v) => v && set(project, ['deltas', BASE, 'entries'], withRule(entries, `own.${own + 1}`, 'text', v))} />
      </div>
      <div class="fab7-group settings-group">{w('desktop.settings.judges')}</div>
      {deny === undefined && <p class="settings-sub">{w('desktop.settings.judges_own')}</p>}
      {(deny ?? []).map((line, i) => (
        <div key={i} class="settings-row settings-row--setting">
          <span class="settings-text">{line}</span>
          <button class="settings-reset" type="button" onClick={() => set(project, ['eval', 'deny'], withDeny(deny, i, null))}>{w('desktop.settings.remove')}</button>
        </div>
      ))}
      <div class="settings-row settings-row--setting">
        <Typed value="" placeholder={w('desktop.settings.add')} keep={(v) => v && set(project, ['eval', 'deny'], withDeny(deny, '+', v))} />
      </div>
      <div class="fab7-group settings-group">{w('desktop.settings.preview')}</div>
      <div class="settings-row settings-row--setting">
        <select class="settings-select" value={host} onChange={(e) => setPick([(e.target as HTMLSelectElement).value, pick[1], pick[2]])}>
          {hosts.map((h) => <option key={h} value={h}>{h}</option>)}
        </select>
        <select class="settings-select" value={pick[1]} onChange={(e) => setPick([pick[0], (e.target as HTMLSelectElement).value, pick[2]])}>
          {['native_plan', 'native_goal', 'native_direct'].map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select class="settings-select" value={pick[2]} onChange={(e) => setPick([pick[0], pick[1], (e.target as HTMLSelectElement).value])}>
          {['implement', 'plan', 'review', 'diagnose'].map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button class="settings-reset" type="button" onClick={() => void m.readSettings(project, 'preview', `${host}|${pick[1]}|${pick[2]}`).then((r) => setPreview(r ? String(r.text) : null))}>{w('desktop.settings.show')}</button>
      </div>
      {preview && <pre class="settings-preview">{preview}</pre>}
    </>
  );
}

export function HarnessesTab({ project }: { project: string }) {
  const rules = useRules(project);
  const [shown, setShown] = useState<string | null>(null);
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const hosts = (rules?.catalogs ?? []).filter((c) => !c.catalog.startsWith('practices/'));
  const host = shown ?? hosts[0]?.catalog ?? null;
  useEffect(() => {
    setProfile(null);
    if (host) void m.readSettings(project, 'profile', host).then(setProfile);
  }, [project, host]);
  if (!rules) return <p class="settings-sub">{w('desktop.settings.asking')}</p>;
  const title = (h: string) => m.harnesses.value.find((x) => x.harness === h)?.title ?? h;
  const layer = (m.settings.value[project]?.machine?.ringframe ?? {}) as { deltas?: Record<string, { entries?: unknown }> };
  const caps = (profile?.capabilities ?? []) as Record<string, unknown>[];
  return (
    <>
      {hosts.map((c) => (
        <div key={c.catalog}>
          <button class={`settings-row${c.catalog === host ? ' settings-row--on' : ''}`} type="button" onClick={() => setShown(c.catalog)}>
            <span class="settings-text">{title(c.catalog)}</span>
            <span class="eval-more">{c.catalog === host ? '⌄' : '›'}</span>
          </button>
          {c.catalog === host && (
            <>
              <div class="fab7-group settings-group">{w('desktop.harness.sends')}</div>
              {!profile && <p class="settings-sub">{w('desktop.settings.asking')}</p>}
              {caps.map((cap) => (
                <div key={String(cap.id)} class="settings-row settings-row--setting">
                  <span class="settings-text">
                    <span>{w(`desktop.harness.${String(cap.id)}`)}</span>
                    {typeof cap.max_prompt_chars === 'number' && <span class="settings-sub">{fill('desktop.harness.limit', { n: String(cap.max_prompt_chars) })}</span>}
                  </span>
                  <span class="settings-sub">{w(cap.delivery_mode === 'human_handoff' ? 'desktop.harness.you_send' : 'desktop.harness.weft_sends')}</span>
                </div>
              ))}
              <div class="fab7-group settings-group">{fill('desktop.harness.route_rules', { harness: title(c.catalog) })}</div>
              {c.entries.map((e) => <RuleRow key={String(e.id)} project={project} catalog={c.catalog} e={e} mine={layer.deltas?.[c.catalog]?.entries} />)}
            </>
          )}
        </div>
      ))}
      <div class="settings-foot"><p>{fill('web.harness.foot', { machine: m.current.value?.name ?? '' })}</p></div>
    </>
  );
}

/** A project's own RingFrame changes (M9.12): the core rules per phase and
 * each rule it sets, beside every project's, with Reset; a rule or the cap
 * added from the choice under them. */
export function ProjectRingFrame({ project }: { project: string }) {
  const [rules, setRules] = useState<{ here: Rules | null; every: Rules | null }>({ here: null, every: null });
  const said = m.settings.value[project];
  useEffect(() => {
    void Promise.all([m.readSettings(project, 'rules', 'project'), m.readSettings(project, 'rules', 'machine')]).then(([here, every]) =>
      setRules({ here: here as Rules | null, every: every as Rules | null }));
  }, [project, said]);
  const layer = (said?.project?.ringframe ?? {}) as { deltas?: Record<string, { entries?: Record<string, unknown>[]; render?: { core_cap?: number } }>; eval?: { deny?: string[] } };
  const base = (r: Rules | null) => r?.catalogs.find((c) => c.catalog === BASE);
  const here = base(rules.here);
  const every = base(rules.every);
  const mine = layer.deltas?.[BASE]?.entries ?? [];
  const cap = layer.deltas?.[BASE]?.render?.core_cap;
  const put = (key: string[], value: unknown) => void m.setSetting(project, 'project', ['ringframe', ...key], value ?? null);
  const said2 = (e: Record<string, unknown> | undefined) => `${String(e?.tier ?? 'core')}, ${e?.enabled === false ? 'off' : 'on'}`;
  const combos = ['core, on', 'core, off', 'situational, on', 'situational, off'];
  const [adding, setAdding] = useState<string | null>(null);
  const shown = (here?.entries ?? []).filter((e) => mine.some((x) => x.id === e.id) || adding === String(e.id));
  return (
    <>
      {(cap !== undefined || adding === 'core_cap') && (
        <div class="settings-row settings-row--setting">
          <span class="settings-text"><span>{w('desktop.settings.core_cap')}</span><span class="settings-sub">{fill('desktop.project.every', { value: String(every?.render?.core_cap ?? 5) })}</span></span>
          <select class="settings-select" value={String(cap ?? '')} onChange={(e) => put(['deltas', BASE, 'render', 'core_cap'], Number((e.target as HTMLSelectElement).value))}>
            {cap === undefined && <option value="">—</option>}
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <button class="settings-reset" type="button" onClick={() => (setAdding(null), put(['deltas', BASE, 'render', 'core_cap'], null))}>{w('act.reset')}</button>
        </div>
      )}
      {shown.map((e) => {
        const id = String(e.id);
        const theirs = every?.entries.find((x) => x.id === id);
        return (
          <div key={id} class="settings-row settings-row--setting">
            <span class="settings-text"><span>{`RingFrame · ${String(e.label ?? id)}`}</span><span class="settings-sub">{fill('desktop.project.every', { value: said2(theirs) })}</span></span>
            <select class="settings-select" value={mine.some((x) => x.id === id) ? said2(e) : ''} onChange={(ev) => {
              const [tier, on] = (ev.target as HTMLSelectElement).value.split(', ');
              put(['deltas', BASE, 'entries'], withRule(withRule(mine, id, 'tier', tier), id, 'enabled', on === 'on'));
            }}>
              {!mine.some((x) => x.id === id) && <option value="">—</option>}
              {combos.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <button class="settings-reset" type="button" onClick={() => (setAdding(null), put(['deltas', BASE, 'entries'], withRule(mine, id, null, null)))}>{w('act.reset')}</button>
          </div>
        );
      })}
      {layer.eval?.deny && (
        <div class="settings-row settings-row--setting">
          <span class="settings-text"><span>{w('desktop.settings.judges')}</span><span class="settings-sub">{layer.eval.deny.join(' · ')}</span></span>
          <button class="settings-reset" type="button" onClick={() => put(['eval', 'deny'], null)}>{w('act.reset')}</button>
        </div>
      )}
      <select class="settings-select settings-add" value="" onChange={(ev) => setAdding((ev.target as HTMLSelectElement).value || null)}>
        <option value="">{`${w('desktop.project.add')} · RingFrame`}</option>
        {cap === undefined && <option value="core_cap">{w('desktop.settings.core_cap')}</option>}
        {(here?.entries ?? []).filter((e) => !mine.some((x) => x.id === e.id)).map((e) => (
          <option key={String(e.id)} value={String(e.id)}>{`RingFrame · ${String(e.label ?? e.id)}`}</option>
        ))}
      </select>
    </>
  );
}
