import { useEffect, useState } from 'react';

import { COPY } from '@/config/copy';
import { SVG_MIME_TYPE } from '@/config/preview';
import { useModelText } from '@/web/hooks/use-model-text';
import { fetchImage } from '@/web/lib/api';
import { fileName } from '@/web/lib/path';

interface ImagePreviewProps {
  path: string;
  // Changes when the file changes on disk, which fetches the picture again.
  revision: number;
}

interface SvgPreviewProps {
  path: string;
}

interface ImageStageProps {
  // null while the picture is on its way.
  source: string | null;
  name: string;
  error?: string | null;
}

interface ImageSize {
  width: number;
  height: number;
}

interface LoadedImage {
  url: string | null;
  error: string | null;
}

const STAGE_CLASSES =
  'absolute inset-0 flex flex-col items-center justify-center gap-3 bg-theme-product-editor p-6';

function ImageStage({ source, name, error = null }: ImageStageProps) {
  const [size, setSize] = useState<ImageSize | null>(null);
  // Remembering which source failed, not just that one did, clears the message by itself
  // when a new picture arrives.
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const message = error ?? (source !== null && failedSource === source ? COPY.IMAGE_FAILED : null);

  if (message) {
    return (
      <div className={STAGE_CLASSES}>
        <p className="text-sm text-theme-text-sec">{message}</p>
      </div>
    );
  }

  return (
    <div className={STAGE_CLASSES}>
      {source && (
        <img
          src={source}
          alt={name}
          onLoad={(event) => {
            const { naturalWidth, naturalHeight } = event.currentTarget;
            setSize({ width: naturalWidth, height: naturalHeight });
          }}
          onError={() => setFailedSource(source)}
          className="min-h-0 max-w-full object-contain"
        />
      )}
      {size && (
        <p className="shrink-0 font-mono text-product-base text-theme-text-sec">
          {COPY.IMAGE_DIMENSIONS(size.width, size.height)}
        </p>
      )}
    </div>
  );
}

// Shows a picture file. It is fetched rather than linked, so a refusal from the server
// (too large, missing) can be shown as its message instead of a broken image.
export function ImagePreview({ path, revision }: ImagePreviewProps) {
  const [image, setImage] = useState<LoadedImage>({ url: null, error: null });

  useEffect(() => {
    let isCancelled = false;
    let objectUrl: string | null = null;

    async function load() {
      const result = await fetchImage(path);
      if (isCancelled) return;
      if (!result.success) {
        setImage({ url: null, error: result.error.message });
        return;
      }
      objectUrl = URL.createObjectURL(result.data);
      setImage({ url: objectUrl, error: null });
    }

    void load();
    return () => {
      isCancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path, revision]);

  return <ImageStage source={image.url} name={fileName(path)} error={image.error} />;
}

// Draws the SVG source as it stands in the editor, unsaved edits included. Inside an image
// element the browser never runs scripts from the SVG.
export function SvgPreview({ path }: SvgPreviewProps) {
  const text = useModelText(path);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(new Blob([text], { type: SVG_MIME_TYPE }));
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [text]);

  return <ImageStage source={url} name={fileName(path)} />;
}
