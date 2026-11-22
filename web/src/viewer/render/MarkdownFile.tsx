// A markdown file: drawn as an agent's message is, with its diagrams and math,
// or its source with line numbers.
import { useEffect, useMemo } from 'preact/hooks';
import { Markdown } from '../../views/Markdown';
import type { RendererProps } from '../factory';
import { decode } from '../text';
import { RICH } from './rich';
import { TextLines } from './TextFile';

export default function MarkdownFile({ bytes, mode, layout, ready }: RendererProps) {
  const text = useMemo(() => decode(bytes ?? new Uint8Array(0)), [bytes]);
  useEffect(ready, []);
  if (mode === 'source') return <TextLines text={text} lang="markdown" layout={layout} />;
  return (
    <div class="viewer-scroll">
      <div class="viewer-doc convo-md">
        <Markdown text={text} rich={RICH} />
      </div>
    </div>
  );
}
