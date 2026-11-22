// A PDF drawn by pdf.js, its pages one under another, each drawn when it
// comes near the view; the page in sight counted at the bottom right. Read
// from its URL a range at a time: only the pages looked at are fetched.
import { useEffect, useRef, useState } from 'preact/hooks';
import { GlobalWorkerOptions, PDFDataRangeTransport, getDocument, type PDFDocumentProxy } from 'pdfjs-dist';
import worker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { RendererProps } from '../factory';

GlobalWorkerOptions.workerSrc = worker;

/** How much pdf.js asks for at a time. */
const CHUNK = 1 << 20;

/** The file's bytes as pdf.js asks for them, each range a request of its own. */
class Ranges extends PDFDataRangeTransport {
  constructor(private url: string, length: number, private failed: (e: unknown) => void) {
    super(length, null);
  }
  override requestDataRange(begin: number, end: number): void {
    fetch(this.url, { headers: { Range: `bytes=${begin}-${end - 1}` }, cache: 'no-store' })
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`HTTP ${r.status}`))))
      // A server that sends the whole file for a range: the part asked for.
      .then((b) => this.onDataRange(begin, new Uint8Array(b.byteLength > end - begin ? b.slice(begin, end) : b)))
      .catch(this.failed);
  }
}

/** The widest a page is drawn, on a wide screen. */
const WIDEST = 860;

function Page({ doc, n, width, ratio }: { doc: PDFDocumentProxy; n: number; width: number; ratio: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [own, setOwn] = useState(ratio);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const seen = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && setNear(true), { rootMargin: '600px 0px' });
    seen.observe(el);
    return () => seen.disconnect();
  }, []);
  useEffect(() => {
    if (!near || !canvas.current || width <= 0) return;
    let task: { cancel(): void; promise: Promise<void> } | null = null;
    let gone = false;
    void doc.getPage(n).then((page) => {
      if (gone || !canvas.current) return;
      const base = page.getViewport({ scale: 1 });
      setOwn(base.height / base.width);
      const viewport = page.getViewport({ scale: width / base.width });
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const c = canvas.current;
      c.width = Math.floor(viewport.width * dpr);
      c.height = Math.floor(viewport.height * dpr);
      task = page.render({ canvas: c, viewport, transform: dpr === 1 ? undefined : [dpr, 0, 0, dpr, 0, 0] });
      task.promise.catch(() => {});
    });
    return () => {
      gone = true;
      task?.cancel();
    };
  }, [near, width, doc, n]);
  return (
    <div class="viewer-pdf-page" ref={box} data-page={n} style={{ width: `${width}px`, height: `${Math.round(width * own)}px` }}>
      <canvas ref={canvas} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}

export default function PdfFile({ file, ready, fail }: RendererProps) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [ratio, setRatio] = useState(1.414);
  const [width, setWidth] = useState(0);
  const [at, setAt] = useState(1);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let gone = false;
    const failed = (e: unknown) => !gone && fail(e);
    // Its size known, pdf.js asks for ranges; else it reads the URL as it can.
    const task = getDocument(
      file.size > 0
        ? { range: new Ranges(file.url, file.size, failed), rangeChunkSize: CHUNK, disableAutoFetch: true }
        : { url: file.url, rangeChunkSize: CHUNK, disableAutoFetch: true, disableStream: true },
    );
    task.promise.then(async (d) => {
      if (gone) return;
      const first = (await d.getPage(1)).getViewport({ scale: 1 });
      if (gone) return;
      setRatio(first.height / first.width);
      setDoc(d);
      ready();
    }, failed);
    return () => {
      gone = true;
      // Its document goes with it.
      void task.destroy();
    };
  }, [file.url]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const look = () => setWidth(Math.min(WIDEST, el.clientWidth - 36));
    look();
    const seen = new ResizeObserver(look);
    seen.observe(el);
    return () => seen.disconnect();
  }, [doc]);

  // The page in sight: the last whose top is above the view's middle.
  const scrolled = () => {
    const el = box.current;
    if (!el) return;
    const middle = el.getBoundingClientRect().top + el.clientHeight / 2;
    let n = 1;
    for (const p of el.querySelectorAll<HTMLElement>('[data-page]')) if (p.getBoundingClientRect().top <= middle) n = Number(p.dataset.page);
    setAt(n);
  };

  if (!doc) return <div />;
  const pages = Array.from({ length: doc.numPages }, (_, i) => i + 1);
  return (
    <div class="viewer-pdf-box">
      <div class="viewer-pdf" ref={box} onScroll={scrolled}>
        {width > 0 && pages.map((n) => <Page key={n} doc={doc} n={n} width={width} ratio={ratio} />)}
      </div>
      <span class="viewer-count">{`${at} / ${doc.numPages}`}</span>
    </div>
  );
}
