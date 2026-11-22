// A file an agent pointed at, filling its window: its name and where it is,
// Rendered | Source where it has both, Reveal where the host can show it in
// the system's file manager, and Close; under them the file drawn as its kind
// is. Loading, it says how far it has come, then that it prepares; a file
// that cannot be drawn here is said so. The same on a phone, where it is a
// sheet over the conversation, and in the desktop's window.
import { Component, type ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { fill, w } from '../words';
import { ReadFailed } from '../views/Read';
import { RENDERER, SWITCHES, readsBytes, renderer, type Layout, type Mode, type Renderer, type Served } from './factory';
import type { Host } from './host';
import { about, folderOf, loadedWords, nameOf, type Ref } from './kinds';
import { load, type Progress } from './source';

export interface ViewerProps {
  /** The file and where it is served; null while its link is made. */
  file: Served | null;
  /** The file as it was named, for the header before the link comes. */
  named: Ref;
  /** Who wrote or named it: the harness, or the agent. */
  who: string;
  layout: Layout;
  host: Host;
  /** The machine says it is gone. */
  gone?: boolean;
  /** The link could not be made; `again` asks for it again. */
  failed?: (() => void) | null;
  /** Its URL answered 404: the link may have lapsed. Without it, the file is said to be gone. */
  lapsed?: () => void;
}

/** A renderer that throws while it draws (a file it cannot read, more than this device can hold). */
class Catch extends Component<{ fail: (e: unknown) => void; children: ComponentChildren }, { thrown: boolean }> {
  state = { thrown: false };
  componentDidCatch(e: unknown) {
    this.setState({ thrown: true });
    this.props.fail(e);
  }
  render() {
    return this.state.thrown ? null : this.props.children;
  }
}

type Status = 'working' | 'gone' | 'cant' | 'failed';

/** Whether a URL serves its file: only a 404 says it does not. */
async function served(url: string, signal: AbortSignal): Promise<boolean> {
  try {
    const r = await fetch(url, { headers: { Range: 'bytes=0-0' }, signal, cache: 'no-store' });
    void r.body?.cancel();
    return r.status !== 404;
  } catch (e) {
    if ((e as { name?: string }).name === 'AbortError') throw e;
    // Not asked as the page's own elements ask (a host that refuses it): the elements try themselves.
    return true;
  }
}

/** A bar and the words under it: how far the file has loaded, then that it prepares. */
function Wait({ progress }: { progress: Progress | null }) {
  const share = progress && progress.total > 0 ? progress.done / progress.total : progress ? null : 1;
  const words = progress ? (progress.total > 0 ? fill('file.loading', loadedWords(progress.done, progress.total)) : '') : w('file.preparing');
  return (
    <div class="viewer-wait" aria-busy="true">
      <span class={share === null ? 'viewer-track viewer-track--moving' : 'viewer-track'} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={share === null ? undefined : Math.round(share * 100)}>
        <i style={share === null ? undefined : { width: `${(share * 100).toFixed(1)}%` }} />
      </span>
      <span class="viewer-wait-words">{words}</span>
    </div>
  );
}

export function Viewer({ file, named, who, layout, host, gone = false, failed = null, lapsed }: ViewerProps) {
  const kind = named.kind;
  const desktop = layout === 'desktop';
  const [mode, setMode] = useState<Mode>('rendered');
  // The kind's renderer: undefined while its code loads, null for a kind not drawn.
  const [Render, setRender] = useState<Renderer | null | undefined>(undefined);
  const [status, setStatus] = useState<Status>('working');
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [checked, setChecked] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [mounted, setMounted] = useState(false);
  const [prepared, setPrepared] = useState(false);
  const [tries, setTries] = useState(0);
  const needs = readsBytes(kind, mode);
  const url = file?.url ?? null;

  useEffect(() => {
    let gone = false;
    void renderer(kind).then(
      (r) => !gone && setRender(() => r),
      () => !gone && setRender(null),
    );
    return () => void (gone = true);
  }, [kind]);

  // A new link is a new read.
  useEffect(() => {
    setBytes(null);
    setChecked(false);
    setStatus('working');
    setPrepared(false);
    setMounted(false);
  }, [url]);

  const notFound = () => (lapsed ? lapsed() : setStatus('gone'));

  // The bytes, for a kind drawn from them; else a look that the URL still serves the file.
  useEffect(() => {
    if (!file || RENDERER[kind] === null || status !== 'working') return;
    if (needs ? bytes : checked || bytes) return;
    const stop = new AbortController();
    let frame = 0;
    let latest: Progress | null = null;
    const told = (p: Progress) => {
      latest = p;
      frame ||= requestAnimationFrame(() => {
        frame = 0;
        setProgress(latest);
      });
    };
    const done = (f: () => void) => {
      cancelAnimationFrame(frame);
      setProgress(null);
      f();
    };
    if (needs) {
      setProgress({ done: 0, total: file.size });
      load(file.url, file.size, { progress: told, signal: stop.signal }).then(
        (r) => done(() => ('bytes' in r ? setBytes(r.bytes) : 'gone' in r ? notFound() : setStatus(r.failed === 'memory' ? 'cant' : 'failed'))),
        () => {},
      );
    } else {
      served(file.url, stop.signal).then((yes) => (yes ? setChecked(true) : notFound()), () => {});
    }
    return () => {
      stop.abort();
      cancelAnimationFrame(frame);
    };
  }, [url, needs, status, tries, bytes, checked]);

  const loaded = needs ? bytes !== null : checked || bytes !== null;
  // Mounted a moment after Preparing… is drawn: a renderer that works long holds the page while it does.
  useEffect(() => {
    if (!loaded || !Render || mounted) return;
    const t = setTimeout(() => setMounted(true), 30);
    return () => clearTimeout(t);
  }, [loaded, Render, mounted]);

  useEffect(() => {
    if (Render === null) setStatus('cant');
  }, [Render]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && host.close();
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  }, [host]);

  const isGone = gone || status === 'gone';
  const cant = !isGone && status === 'cant';
  const shown: Ref = file ?? named;
  const name = nameOf(named.path);

  let body;
  if (isGone) body = <div class="viewer-body viewer-middle"><p class="viewer-said">{fill('file.gone', { path: named.path })}</p></div>;
  else if (cant) body = <div class="viewer-body viewer-middle"><p class="viewer-said">{fill('file.cant_show', { name })}</p></div>;
  else if (failed || status === 'failed') {
    const again = failed ?? (() => (setStatus('working'), setTries((n) => n + 1)));
    body = <div class="viewer-body viewer-middle"><ReadFailed text={fill('file.unreadable', { path: named.path })} again={again} /></div>;
  } else {
    const fail = () => setStatus('cant');
    body = (
      <div class="viewer-body">
        {file && Render && mounted && loaded && (
          <Catch fail={fail}>
            <Render file={{ ...file, kind }} bytes={bytes} mode={mode} layout={layout} ready={() => setPrepared(true)} fail={fail} />
          </Catch>
        )}
        {!(mounted && loaded && prepared) && <div class="viewer-cover"><Wait progress={needs && !bytes ? progress ?? { done: 0, total: shown.size } : null} /></div>}
      </div>
    );
  }

  const switches = SWITCHES.has(kind) && !isGone && !cant && file !== null && (
    <div class="viewer-switch" role="tablist">
      {(['rendered', 'source'] as const).map((v) => (
        <button key={v} type="button" role="tab" aria-selected={mode === v} class={mode === v ? 'viewer-seg viewer-seg--on' : 'viewer-seg'} onClick={() => setMode(v)}>
          {w(`file.${v}`)}
        </button>
      ))}
    </div>
  );
  const meta = isGone ? folderOf(named.path) : about(shown, who, desktop);

  return (
    <div class={`viewer viewer--${layout}`} role="dialog" aria-label={name}>
      <div class="viewer-head">
        {desktop ? (
          <>
            <b class="viewer-title">{name}</b>
            <span class="viewer-meta">{meta}</span>
          </>
        ) : (
          <div class="viewer-name">
            <b>{name}</b>
            <span>{meta}</span>
          </div>
        )}
        <span class="spacer" />
        {switches}
        {host.reveal && !isGone && <button type="button" class="viewer-btn" onClick={host.reveal}>{w('file.reveal')}</button>}
        <button type="button" class="viewer-btn" onClick={host.close}>{w('file.close')}</button>
      </div>
      {body}
    </div>
  );
}
