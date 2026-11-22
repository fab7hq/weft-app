// A Word document drawn as its pages by docx-preview, one under another. On
// a view narrower than a page, the text fits the view instead.
import { useEffect, useRef } from 'preact/hooks';
import type { RendererProps } from '../factory';

/** Narrower than this, a page fits the view: a Letter page is 816 px wide. */
const PAGE = 860;

export default function DocumentFile({ bytes, ready, fail }: RendererProps) {
  const box = useRef<HTMLDivElement>(null);
  const styles = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    if (!el || !bytes) return;
    let gone = false;
    void import('docx-preview')
      .then(({ renderAsync }) =>
        renderAsync(bytes, el, styles.current ?? undefined, {
          className: 'docx',
          ignoreWidth: el.clientWidth < PAGE,
          ignoreHeight: el.clientWidth < PAGE,
          // An embedded page would run with the viewer's own origin.
          renderAltChunks: false,
          renderComments: false,
          useBase64URL: true,
        }),
      )
      .then(
        () => {
          if (gone) return;
          // A link goes only to the web, an address or a place in the document.
          for (const a of el.querySelectorAll('a[href]')) {
            const href = a.getAttribute('href') ?? '';
            if (/^(https?:|mailto:|#)/i.test(href)) a.setAttribute('target', href.startsWith('#') ? '_self' : '_blank');
            else a.removeAttribute('href');
          }
          ready();
        },
        (e) => !gone && fail(e),
      );
    return () => {
      gone = true;
      el.replaceChildren();
    };
  }, [bytes]);
  return (
    <div class="viewer-scroll viewer-docx">
      <div ref={styles} />
      <div ref={box} />
    </div>
  );
}
