// Which renderer draws each kind, and where its code is: each is its own
// chunk, loaded the first time a file of its kind is opened. A kind with no
// renderer is not drawn: the viewer says it can't be shown here.
import type { ComponentType } from 'preact';
import type { Kind, Ref } from './kinds';

/** Rendered draws the file as it is meant to be seen; Source shows its text. */
export type Mode = 'rendered' | 'source';

/** The phone's sheet, or the desktop's window. */
export type Layout = 'phone' | 'desktop';

/** A file to draw: what the machine says of it, and the URL it is served at. */
export interface Served extends Ref {
  url: string;
}

export interface RendererProps {
  file: Served;
  /** The file's bytes, for a kind drawn from them; null for one loaded from its URL. */
  bytes: Uint8Array | null;
  mode: Mode;
  layout: Layout;
  /** Drawn: the viewer stops saying it prepares. */
  ready(): void;
  /** Could not be drawn (unreadable, too large for this device): the viewer says it can't be shown. */
  fail(why: unknown): void;
}

export type Renderer = ComponentType<RendererProps>;

export type Name = 'markdown' | 'text' | 'image' | 'media' | 'table' | 'document' | 'notebook' | 'pdf' | 'html';

/** Each kind's renderer, or null when none draws it. */
export const RENDERER: Record<Kind, Name | null> = {
  markdown: 'markdown',
  text: 'text',
  image: 'image',
  video: 'media',
  audio: 'media',
  csv: 'table',
  sheet: 'table',
  document: 'document',
  notebook: 'notebook',
  pdf: 'pdf',
  html: 'html',
  other: null,
};

/** The kinds that are drawn and also have a text to show: Rendered | Source. */
export const SWITCHES: ReadonlySet<Kind> = new Set<Kind>(['markdown', 'html']);

/** The kinds the browser loads from their URL itself (with ranges where it reads them), never read whole first. */
const FROM_URL: ReadonlySet<Kind> = new Set<Kind>(['image', 'video', 'audio', 'pdf', 'html']);

/** Whether the viewer reads the file's bytes before drawing it: an HTML page's source is read, the page itself is not. */
export const readsBytes = (kind: Kind, mode: Mode): boolean => RENDERER[kind] !== null && (!FROM_URL.has(kind) || (kind === 'html' && mode === 'source'));

/** Each renderer's code, imported when first needed. */
export const LOAD: Record<Name, () => Promise<{ default: Renderer }>> = {
  markdown: () => import('./render/MarkdownFile'),
  text: () => import('./render/TextFile'),
  image: () => import('./render/ImageFile'),
  media: () => import('./render/MediaFile'),
  table: () => import('./render/TableFile'),
  document: () => import('./render/DocumentFile'),
  notebook: () => import('./render/NotebookFile'),
  pdf: () => import('./render/PdfFile'),
  html: () => import('./render/HtmlFile'),
};

/** The renderer for a kind, or null for one not drawn here. */
export async function renderer(kind: Kind): Promise<Renderer | null> {
  const name = RENDERER[kind] ?? null;
  return name ? (await LOAD[name]()).default : null;
}
