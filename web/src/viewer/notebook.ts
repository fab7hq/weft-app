// A Jupyter notebook (.ipynb) as cells the viewer draws: markdown, code with
// its run's number, and each output as text, an image or an HTML page.

export type Output = { kind: 'text'; text: string; error?: boolean } | { kind: 'image'; src: string } | { kind: 'html'; html: string };

export type Cell = { kind: 'markdown'; text: string } | { kind: 'code'; count: number | null; source: string; outputs: Output[] } | { kind: 'raw'; text: string };

export interface Notebook {
  /** The kernel's language, as the notebook names it. */
  lang?: string;
  cells: Cell[];
}

type Json = Record<string, unknown>;

/** A notebook's text, a string or the list of lines it is often split into. */
const joined = (v: unknown): string => (Array.isArray(v) ? v.map(String).join('') : typeof v === 'string' ? v : '');

/** Colours and moves a terminal reads, as a traceback carries them. */
const ANSI = /\u001b\[[0-9;?]*[A-Za-z]/g;

const IMAGES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

/** What one output draws: an image first, then a page, then its text. */
export function outputOf(o: Json): Output | null {
  const type = o.output_type;
  if (type === 'stream') return { kind: 'text', text: joined(o.text), ...(o.name === 'stderr' ? { error: true } : {}) };
  if (type === 'error') {
    const trace = Array.isArray(o.traceback) ? o.traceback.map(String).join('\n') : `${joined(o.ename)}: ${joined(o.evalue)}`;
    return { kind: 'text', text: trace.replace(ANSI, ''), error: true };
  }
  if (type !== 'execute_result' && type !== 'display_data') return null;
  const data = (o.data ?? {}) as Json;
  for (const mime of IMAGES) if (data[mime]) return { kind: 'image', src: `data:${mime};base64,${joined(data[mime]).replace(/\s+/g, '')}` };
  if (data['image/svg+xml']) return { kind: 'image', src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(joined(data['image/svg+xml']))}` };
  if (data['text/html']) return { kind: 'html', html: joined(data['text/html']) };
  if (data['text/plain'] !== undefined) return { kind: 'text', text: joined(data['text/plain']) };
  if (data['application/json'] !== undefined) return { kind: 'text', text: JSON.stringify(data['application/json'], null, 2) };
  return null;
}

/** The notebook in a file's text; throws when it is not one. */
export function parseNotebook(text: string): Notebook {
  const nb = JSON.parse(text) as Json;
  // nbformat 3 kept its cells in worksheets.
  const raw = Array.isArray(nb.cells) ? nb.cells : Array.isArray(nb.worksheets) ? (nb.worksheets as Json[]).flatMap((w) => (Array.isArray(w.cells) ? w.cells : [])) : null;
  if (!raw) throw new Error('not a notebook');
  const meta = (nb.metadata ?? {}) as Json;
  const lang = ((meta.kernelspec as Json | undefined)?.language ?? (meta.language_info as Json | undefined)?.name) as string | undefined;
  const cells: Cell[] = [];
  for (const c of raw as Json[]) {
    const type = c.cell_type;
    if (type === 'markdown' || type === 'heading') cells.push({ kind: 'markdown', text: joined(c.source) });
    else if (type === 'code') {
      const count = typeof c.execution_count === 'number' ? c.execution_count : typeof c.prompt_number === 'number' ? c.prompt_number : null;
      const outputs = (Array.isArray(c.outputs) ? (c.outputs as Json[]) : []).map(outputOf).filter((o): o is Output => o !== null);
      cells.push({ kind: 'code', count, source: joined(c.source ?? c.input), outputs });
    } else cells.push({ kind: 'raw', text: joined(c.source) });
  }
  return { ...(typeof lang === 'string' ? { lang } : {}), cells };
}
