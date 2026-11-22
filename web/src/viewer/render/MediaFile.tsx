// A video or a sound, in the system's own player, read from its URL as it plays.
import type { RendererProps } from '../factory';
import { nameOf } from '../kinds';

export default function MediaFile({ file, ready, fail }: RendererProps) {
  const label = nameOf(file.path);
  return (
    <div class={`viewer-media viewer-media--${file.kind}`}>
      {file.kind === 'audio' ? (
        <audio src={file.url} controls preload="metadata" aria-label={label} onLoadedMetadata={ready} onError={fail} />
      ) : (
        <video src={file.url} controls playsInline preload="metadata" aria-label={label} onLoadedMetadata={ready} onError={fail} />
      )}
    </div>
  );
}
