// An HTML page in a frame of its own, from its URL: its scripts run, but it
// has no origin of its own, so it reaches nothing of the viewer's. Or its source.
import { useEffect, useMemo } from 'preact/hooks';
import type { RendererProps } from '../factory';
import { nameOf } from '../kinds';
import { decode } from '../text';
import { TextLines } from './TextFile';

export default function HtmlFile({ file, bytes, mode, layout, ready }: RendererProps) {
  const text = useMemo(() => (mode === 'source' && bytes ? decode(bytes) : ''), [bytes, mode]);
  useEffect(() => {
    if (mode === 'source') ready();
  }, [mode]);
  if (mode === 'source') return <TextLines text={text} lang="html" layout={layout} />;
  return (
    <div class="viewer-page">
      <iframe class="viewer-frame" src={file.url} sandbox="allow-scripts" title={nameOf(file.path)} referrerpolicy="no-referrer" onLoad={ready} />
    </div>
  );
}
