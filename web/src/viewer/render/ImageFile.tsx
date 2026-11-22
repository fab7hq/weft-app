// An image, from its URL.
import type { RendererProps } from '../factory';
import { nameOf } from '../kinds';

export default function ImageFile({ file, ready, fail }: RendererProps) {
  return (
    <div class="viewer-scroll viewer-image">
      <img src={file.url} alt={nameOf(file.path)} onLoad={ready} onError={fail} />
    </div>
  );
}
