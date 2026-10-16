// A screen as a Toile card: the page as drawn, each element with the styles
// it was drawn in, so a card is what the app builds. Only what differs from
// a bare element of the same tag is written, and an inherited value only
// where it changes from the parent's. A canvas is kept as its picture.
import type { Page } from '@playwright/test';

/** The card of what `page` shows now, at its viewport's size, named `title`. */
export async function card(page: Page, title: string): Promise<string> {
  const body = await page.evaluate(() => {
    const INHERITED = new Set(['color', 'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing', 'text-align', 'white-space', 'visibility', 'cursor', 'text-transform', 'word-break', 'overflow-wrap']);
    const sandbox = document.createElement('iframe');
    sandbox.style.cssText = 'position:absolute;width:0;height:0;border:0;visibility:hidden';
    document.body.appendChild(sandbox);
    const bare = new Map<string, CSSStyleDeclaration>();
    const defaults = (tag: string) => {
      if (!bare.has(tag)) {
        const el = sandbox.contentDocument!.createElement(tag);
        sandbox.contentDocument!.body.appendChild(el);
        bare.set(tag, sandbox.contentWindow!.getComputedStyle(el));
      }
      return bare.get(tag)!;
    };
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const attr = (s: string) => esc(s).replace(/"/g, '&quot;');
    const walk = (el: Element, parent: CSSStyleDeclaration | null): string => {
      const cs = getComputedStyle(el);
      if (cs.display === 'none') return '';
      const tag = el.tagName.toLowerCase();
      if (tag === 'script' || tag === 'style' || tag === 'link' || tag === 'iframe' || tag === 'noscript') return '';
      // A card runs nothing: a field or a button is drawn as a box, so its
      // styles are written against a bare box, the element the card holds.
      const name = ['body', 'html', 'input', 'textarea', 'select', 'button', 'p'].includes(tag) ? 'div' : tag;
      const base = defaults(name);
      const plain = defaults('div');
      const decl: string[] = [];
      for (let i = 0; i < cs.length; i++) {
        const p = cs[i];
        if (p.startsWith('--') || p.startsWith('-webkit-') || p === 'transition' || p.startsWith('transition-') || p.startsWith('animation')) continue;
        const v = cs.getPropertyValue(p);
        // The card's tokens make every box border-box: each says its own.
        if (p === 'box-sizing') { decl.push(`${p}:${v}`); continue; }
        // An inherited value is written where it changes from the parent's,
        // or where this tag's own default (a heading's size) would differ.
        const own = base.getPropertyValue(p) !== plain.getPropertyValue(p);
        if (INHERITED.has(p) ? parent !== null && parent.getPropertyValue(p) === v && !own : base.getPropertyValue(p) === v) continue;
        decl.push(`${p}:${v}`);
        // A side's line is its style and its width together: a style alone draws 3 px.
        const side = p.match(/^border-(top|right|bottom|left)-style$/);
        if (side && v !== 'none') decl.push(`border-${side[1]}-width:${cs.getPropertyValue(`border-${side[1]}-width`)}`);
      }
      // A button centres what it holds by itself; the box that draws it must say so.
      if (tag === 'button' && !/flex|grid/.test(cs.display)) decl.push('display:inline-flex', 'align-items:center', `justify-content:${cs.textAlign === 'left' || cs.textAlign === 'start' ? 'flex-start' : 'center'}`);
      // Its box as drawn, so a card keeps the app's geometry.
      const r = el.getBoundingClientRect();
      if (tag === 'canvas') {
        const src = (el as HTMLCanvasElement).toDataURL('image/png');
        return `<img src="${src}" style="${attr(decl.join(';'))};width:${r.width}px;height:${r.height}px">`;
      }
      // A ::before or ::after drawn by the app, as a span the card can hold.
      const pseudo = (where: '::before' | '::after') => {
        const ps = getComputedStyle(el, where);
        const c = ps.content;
        if (!c || c === 'none' || c === 'normal' || ps.display === 'none') return '';
        // The first string of the content: what is drawn, before any alternative text.
        const q = c.match(/"((?:[^"\\]|\\.)*)"/);
        const text = (q ? q[1] : '').replace(/\\([0-9a-f]{1,6}) ?/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)));
        if (!text) return '';
        const keep = ['color', 'font-family', 'font-size', 'font-weight', 'margin-left', 'margin-right', 'padding-left', 'padding-right', 'letter-spacing'].map((q) => `${q}:${ps.getPropertyValue(q)}`).join(';');
        return `<span style="${attr(keep)}">${esc(text)}</span>`;
      };
      let inner = pseudo('::before');
      for (const n of el.childNodes) {
        if (n.nodeType === Node.TEXT_NODE) inner += esc(n.textContent ?? '');
        else if (n.nodeType === Node.ELEMENT_NODE) inner += walk(n as Element, cs);
      }
      inner += pseudo('::after');
      if (tag === 'input' || tag === 'textarea') {
        const f = el as HTMLInputElement;
        inner = esc(f.value || f.placeholder || '');
        if (!f.value) decl.push('color:var(--fab7-faint)');
      }
      const keep = el.namespaceURI === 'http://www.w3.org/2000/svg' ? [...el.attributes].filter((a) => a.name !== 'class' && a.name !== 'style').map((a) => ` ${a.name}="${attr(a.value)}"`).join('') : '';
      const label = el.getAttribute('aria-label');
      return `<${name}${keep}${label ? ` layer-name="${attr(label)}"` : ''} style="${attr(decl.join(';'))}">${inner}</${name}>`;
    };
    const root = document.getElementById('app') ?? document.body;
    const out = walk(root, null);
    sandbox.remove();
    return out;
  });
  const { width, height } = page.viewportSize()!;
  return `<div data-title="${title}" style="width:${width}px;height:${height}px;overflow:hidden;position:relative;background:var(--fab7-canvas);font-family:var(--font-sans);color:var(--fab7-text)">${body}</div>\n`;
}
