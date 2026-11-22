// Markdown as a viewer reads it: marked's lexer, knowing math as TeX between
// `$…$` or `\(…\)` in a line, and `$$…$$` or `\[…\]` as a block of its own. A
// `$` before a digit is money, not math.
import { Marked, type Token, type TokenizerAndRendererExtension } from 'marked';

const BLOCK = [/^\$\$([\s\S]+?)\$\$[^\S\n]*(?:\n|$)/, /^\\\[([\s\S]+?)\\\][^\S\n]*(?:\n|$)/];
const INLINE = [/^\$\$([^$\n]+?)\$\$/, /^\$(?![\s$])((?:\\.|[^\\$\n])+?)(?<!\s)\$(?!\d)/, /^\\\(([\s\S]+?)\\\)/];

const mathBlock: TokenizerAndRendererExtension = {
  name: 'math_block',
  level: 'block',
  start: (src) => src.match(/(?:^|\n)(?:\$\$|\\\[)/)?.index,
  tokenizer(src) {
    for (const re of BLOCK) {
      const m = re.exec(src);
      if (m) return { type: 'math_block', raw: m[0], text: m[1].trim() };
    }
    return undefined;
  },
};

const mathInline: TokenizerAndRendererExtension = {
  name: 'math_inline',
  level: 'inline',
  start: (src) => {
    const i = src.search(/\$|\\\(/);
    return i < 0 ? undefined : i;
  },
  tokenizer(src) {
    for (const re of INLINE) {
      const m = re.exec(src);
      if (m) return { type: 'math_inline', raw: m[0], text: m[1].trim() };
    }
    return undefined;
  },
};

const reader = new Marked({ gfm: true, extensions: [mathBlock, mathInline] });

export const lexMath = (text: string): Token[] => reader.lexer(text);
