'use client';

export interface ClientCompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

/**
 * Pré-otimiza a imagem no navegador antes do upload para:
 * 1) Evitar estourar o limite de 4.5 MB por requisição serverless da Vercel;
 * 2) Acelerar o upload em conexões móveis;
 * 3) Preservar resolução suficiente para o servidor gerar o WebP final + miniatura via sharp.
 */
export async function compressImageForUpload(
  file: File,
  options: ClientCompressOptions = {}
): Promise<File> {
  if (typeof window === 'undefined') return file;

  const { maxWidth = 1600, maxHeight = 2000, quality = 0.9 } = options;

  // Não mexe em SVG/GIF animado ou arquivos já bem pequenos em WebP
  const type = (file.type || '').toLowerCase();
  if (type === 'image/svg+xml' || type === 'image/gif') {
    return file;
  }
  if (type === 'image/webp' && file.size <= 350 * 1024) {
    return file;
  }

  let objectUrl: string | null = null;
  try {
    let width = 0;
    let height = 0;
    let drawSource: CanvasImageSource;
    let bitmap: ImageBitmap | null = null;

    if (typeof createImageBitmap === 'function') {
      bitmap = await createImageBitmap(file);
      width = bitmap.width;
      height = bitmap.height;
      drawSource = bitmap;
    } else {
      objectUrl = URL.createObjectURL(file);
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new window.Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('Falha ao decodificar imagem no navegador.'));
        el.src = objectUrl!;
      });
      width = img.naturalWidth || img.width;
      height = img.naturalHeight || img.height;
      drawSource = img;
    }

    if (!width || !height) {
      if (bitmap) bitmap.close();
      return file;
    }

    const ratio = Math.min(1, maxWidth / width, maxHeight / height);
    const targetW = Math.max(1, Math.round(width * ratio));
    const targetH = Math.max(1, Math.round(height * ratio));

    // Se já é pequeno e WebP, evita re-encodar no client
    if (ratio === 1 && type === 'image/webp' && file.size <= 600 * 1024) {
      if (bitmap) bitmap.close();
      return file;
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      if (bitmap) bitmap.close();
      return file;
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(drawSource, 0, 0, targetW, targetH);

    if (bitmap) bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/webp', quality);
    });

    if (!blob) return file;

    // Só substitui se realmente reduziu o tamanho (ou se não era WebP e precisa de conversão/redimensionamento)
    if (blob.size >= file.size && ratio === 1 && type === 'image/webp') {
      return file;
    }

    const baseName = file.name.replace(/\.[^/.]+$/, '') || 'imagem';
    return new File([blob], `${baseName}.webp`, {
      type: 'image/webp',
      lastModified: Date.now(),
    });
  } catch {
    return file;
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}
