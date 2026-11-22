// Code highlighted by Shiki, in the app's own colours: its core and the one
// grammar a file needs load only when such a file is opened. A text is
// tokenized a block of lines at a time, each block going on from the state
// the one before ended in, so a long file is highlighted where it is read.
import type { HighlighterCore, ThemeRegistrationRaw } from 'shiki/core';

/** A run of a line in one colour. */
export interface Token {
  text: string;
  color?: string;
  bold?: boolean;
  italic?: boolean;
}

export type TokenLine = Token[];

/** The grammar's state where a block ended, to go on from. */
export type State = unknown;

export interface Tokenizer {
  tokenize(code: string, state?: State): { lines: TokenLine[]; state: State };
}

const FG = '#f1f3f7';

/** One dark theme, the cards' colours: keywords blue, strings teal, comments faint, numbers amber, definitions bold. */
const THEME: ThemeRegistrationRaw = {
  name: 'weft',
  type: 'dark',
  settings: [
    { settings: { foreground: FG, background: '#05080f' } },
    { scope: ['keyword', 'storage', 'constant.language', 'variable.language', 'support.type.primitive', 'entity.name.tag', 'keyword.operator.word', 'keyword.operator.new', 'keyword.operator.expression'], settings: { foreground: '#58a6ff' } },
    { scope: ['keyword.operator', 'punctuation.separator', 'punctuation.section', 'punctuation.accessor'], settings: { foreground: FG } },
    { scope: ['string', 'markup.inline.raw', 'markup.raw', 'string.regexp'], settings: { foreground: '#39c5bb' } },
    { scope: ['constant.numeric', 'constant.character.escape', 'entity.other.attribute-name'], settings: { foreground: '#edbb5b' } },
    { scope: ['comment', 'punctuation.definition.comment', 'string.quoted.docstring', 'string.comment'], settings: { foreground: '#6e7b8f' } },
    { scope: ['entity.name.function', 'entity.name.type', 'entity.name.class', 'markup.heading', 'markup.bold'], settings: { foreground: FG, fontStyle: 'bold' } },
    { scope: ['markup.italic'], settings: { fontStyle: 'italic' } },
  ],
};

/** Each grammar's code, by Shiki's name for it. */
const GRAMMARS: Record<string, () => Promise<unknown>> = {
  bash: () => import('shiki/langs/shellscript.mjs'),
  c: () => import('shiki/langs/c.mjs'),
  cpp: () => import('shiki/langs/cpp.mjs'),
  csharp: () => import('shiki/langs/csharp.mjs'),
  css: () => import('shiki/langs/css.mjs'),
  dart: () => import('shiki/langs/dart.mjs'),
  diff: () => import('shiki/langs/diff.mjs'),
  docker: () => import('shiki/langs/docker.mjs'),
  elixir: () => import('shiki/langs/elixir.mjs'),
  go: () => import('shiki/langs/go.mjs'),
  graphql: () => import('shiki/langs/graphql.mjs'),
  haskell: () => import('shiki/langs/haskell.mjs'),
  hcl: () => import('shiki/langs/hcl.mjs'),
  html: () => import('shiki/langs/html.mjs'),
  ini: () => import('shiki/langs/ini.mjs'),
  java: () => import('shiki/langs/java.mjs'),
  javascript: () => import('shiki/langs/javascript.mjs'),
  json: () => import('shiki/langs/json.mjs'),
  jsonc: () => import('shiki/langs/jsonc.mjs'),
  jsx: () => import('shiki/langs/jsx.mjs'),
  julia: () => import('shiki/langs/julia.mjs'),
  kotlin: () => import('shiki/langs/kotlin.mjs'),
  latex: () => import('shiki/langs/latex.mjs'),
  lua: () => import('shiki/langs/lua.mjs'),
  make: () => import('shiki/langs/make.mjs'),
  markdown: () => import('shiki/langs/markdown.mjs'),
  nix: () => import('shiki/langs/nix.mjs'),
  ocaml: () => import('shiki/langs/ocaml.mjs'),
  php: () => import('shiki/langs/php.mjs'),
  powershell: () => import('shiki/langs/powershell.mjs'),
  proto: () => import('shiki/langs/proto.mjs'),
  python: () => import('shiki/langs/python.mjs'),
  r: () => import('shiki/langs/r.mjs'),
  ruby: () => import('shiki/langs/ruby.mjs'),
  rust: () => import('shiki/langs/rust.mjs'),
  scala: () => import('shiki/langs/scala.mjs'),
  scss: () => import('shiki/langs/scss.mjs'),
  sql: () => import('shiki/langs/sql.mjs'),
  svelte: () => import('shiki/langs/svelte.mjs'),
  swift: () => import('shiki/langs/swift.mjs'),
  toml: () => import('shiki/langs/toml.mjs'),
  tsx: () => import('shiki/langs/tsx.mjs'),
  typescript: () => import('shiki/langs/typescript.mjs'),
  vue: () => import('shiki/langs/vue.mjs'),
  xml: () => import('shiki/langs/xml.mjs'),
  yaml: () => import('shiki/langs/yaml.mjs'),
  zig: () => import('shiki/langs/zig.mjs'),
};

/** A file's grammar by its extension, or its whole name. */
const BY_NAME: Record<string, string> = {
  sh: 'bash', bash: 'bash', zsh: 'bash', c: 'c', h: 'c', cc: 'cpp', cpp: 'cpp', cxx: 'cpp', hpp: 'cpp', hh: 'cpp',
  cs: 'csharp', css: 'css', dart: 'dart', diff: 'diff', patch: 'diff', dockerfile: 'docker', ex: 'elixir', exs: 'elixir',
  go: 'go', graphql: 'graphql', gql: 'graphql', hs: 'haskell', tf: 'hcl', hcl: 'hcl', html: 'html', htm: 'html',
  ini: 'ini', cfg: 'ini', conf: 'ini', java: 'java', js: 'javascript', mjs: 'javascript', cjs: 'javascript',
  json: 'json', jsonc: 'jsonc', jsonl: 'json', jsx: 'jsx', jl: 'julia', kt: 'kotlin', kts: 'kotlin', tex: 'latex',
  lua: 'lua', makefile: 'make', mk: 'make', md: 'markdown', markdown: 'markdown', nix: 'nix', ml: 'ocaml',
  php: 'php', ps1: 'powershell', proto: 'proto', py: 'python', pyi: 'python', r: 'r', rb: 'ruby', rs: 'rust',
  scala: 'scala', scss: 'scss', sql: 'sql', svelte: 'svelte', swift: 'swift', toml: 'toml', tsx: 'tsx',
  ts: 'typescript', mts: 'typescript', cts: 'typescript', vue: 'vue', xml: 'xml', svg: 'xml', plist: 'xml',
  yaml: 'yaml', yml: 'yaml', zig: 'zig',
};

/** The grammar a file is highlighted with, by its name; null for one with none (a log, plain text). */
export function langOf(path: string): string | null {
  const name = (path.split('/').pop() ?? '').toLowerCase();
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1) : name;
  return BY_NAME[ext] ?? BY_NAME[name] ?? null;
}

/** A language as a notebook names it (`python`, `R`), as Shiki's name; null when none is had. */
export const langNamed = (name: string | undefined): string | null => {
  const n = (name ?? '').toLowerCase();
  return n in GRAMMARS ? n : (BY_NAME[n] ?? null);
};

let core: Promise<HighlighterCore> | null = null;

function highlighter(): Promise<HighlighterCore> {
  core ??= (async () => {
    const [{ createHighlighterCore }, { createJavaScriptRegexEngine }] = await Promise.all([import('shiki/core'), import('shiki/engine/javascript')]);
    return createHighlighterCore({ themes: [THEME], langs: [], engine: createJavaScriptRegexEngine() });
  })();
  return core;
}

/** A line longer than this is left plain: tokenizing it would hold up the page. */
const LONGEST = 4000;

/** A tokenizer for this language, its grammar loaded; null when there is none. */
export async function tokenizer(lang: string | null): Promise<Tokenizer | null> {
  const grammar = lang ? GRAMMARS[lang] : undefined;
  if (!lang || !grammar) return null;
  const hl = await highlighter();
  if (!hl.getLoadedLanguages().includes(lang)) await hl.loadLanguage(grammar as never);
  return {
    tokenize(code, state) {
      const r = hl.codeToTokens(code, { lang, theme: 'weft', tokenizeMaxLineLength: LONGEST, ...(state ? { grammarState: state as never } : {}) });
      return { lines: r.tokens.map((line) => line.map(toToken)), state: r.grammarState };
    },
  };
}

function toToken(t: { content: string; color?: string; fontStyle?: number }): Token {
  const out: Token = { text: t.content };
  if (t.color && t.color.toLowerCase() !== FG) out.color = t.color;
  if (t.fontStyle && t.fontStyle & 2) out.bold = true;
  if (t.fontStyle && t.fontStyle & 1) out.italic = true;
  return out;
}
