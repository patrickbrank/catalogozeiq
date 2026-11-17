import sharp from 'sharp';

export const STORAGE_CACHE_CONTROL = '31536000'; // 1 ano de cache em CDN/Navegador

export async function optimizeProductImageBuffer(inputBuffer: Buffer): Promise<{
  mainBuffer: Buffer;
  thumbBuffer: Buffer;
}> {
  const base = sharp(inputBuffer, { failOn: 'none' }).rotate();

  const [mainBuffer, thumbBuffer] = await Promise.all([
    base
      .clone()
      .resize({
        width: 1200,
        height: 1600,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({
        quality: 84,
        effort: 5,
      })
      .toBuffer(),
    base
      .clone()
      .resize({
        width: 480,
        height: 640,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({
        quality: 80,
        effort: 5,
      })
      .toBuffer(),
  ]);

  return { mainBuffer, thumbBuffer };
}

export async function optimizeBannerImageBuffer(
  inputBuffer: Buffer,
  type: 'desktop' | 'mobile' | string
): Promise<Buffer> {
  const isMobile = type === 'mobile';
  return sharp(inputBuffer, { failOn: 'none' })
    .rotate()
    .resize({
      width: isMobile ? 900 : 1720,
      height: isMobile ? 900 : 800,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({
      quality: isMobile ? 83 : 85,
      effort: 5,
    })
    .toBuffer();
}

export async function optimizeAvatarImageBuffer(inputBuffer: Buffer): Promise<Buffer> {
  return sharp(inputBuffer, { failOn: 'none' })
    .rotate()
    .resize({
      width: 400,
      height: 400,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({
      quality: 82,
      effort: 5,
    })
    .toBuffer();
}
