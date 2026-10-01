// Client-side image processing. Re-encoding through a canvas drops all EXIF/GPS metadata.

async function decode(file: File | Blob): Promise<ImageBitmap> {
  // imageOrientation applies the EXIF rotation before metadata is discarded.
  return createImageBitmap(file, { imageOrientation: "from-image" });
}

function toWebp(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not process image"))), "image/webp", quality)
  );
}

/** Encode, lowering quality then dimensions until it fits under maxBytes. */
async function encodeUnder(draw: (size: number) => HTMLCanvasElement, startSize: number, maxBytes: number): Promise<Blob> {
  let size = startSize;
  for (let round = 0; round < 6; round++) {
    const canvas = draw(size);
    for (const q of [0.85, 0.75, 0.65, 0.55, 0.45, 0.35]) {
      const blob = await toWebp(canvas, q);
      if (blob.size <= maxBytes) return blob;
    }
    size = Math.round(size * 0.85);
  }
  throw new Error("This image is too large to compress. Try a smaller photo.");
}

export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function assertImage(file: File) {
  if (!ACCEPTED_TYPES.includes(file.type)) throw new Error("Use a JPG, PNG or WebP photo");
  if (file.size > 25 * 1024 * 1024) throw new Error("That file is over 25 MB");
}

/** Listing photo: max 1600px on the longest side, WebP, under 400KB. */
export async function compressListingImage(file: File): Promise<Blob> {
  assertImage(file);
  const bmp = await decode(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const w0 = Math.round(bmp.width * scale), h0 = Math.round(bmp.height * scale);
  const blob = await encodeUnder(
    (size) => {
      const k = size / 1600;
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(w0 * Math.min(1, k)));
      canvas.height = Math.max(1, Math.round(h0 * Math.min(1, k)));
      canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
      return canvas;
    },
    1600,
    400 * 1024
  );
  bmp.close();
  return blob;
}

export type Crop = { zoom: number; x: number; y: number }; // zoom >= 1, x/y in [-1, 1]

/** Draw the square crop region of bmp onto ctx at `size` px. */
export function drawSquare(ctx: CanvasRenderingContext2D, bmp: ImageBitmap, crop: Crop, size: number) {
  const side = Math.min(bmp.width, bmp.height) / crop.zoom;
  const sx = (bmp.width - side) / 2 + (crop.x * (bmp.width - side)) / 2;
  const sy = (bmp.height - side) / 2 + (crop.y * (bmp.height - side)) / 2;
  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(bmp, sx, sy, side, side, 0, 0, size, size);
}

export async function loadBitmap(file: File): Promise<ImageBitmap> {
  assertImage(file);
  return decode(file);
}

/** Profile photo: square crop, 640px, WebP, under 300KB. */
export async function compressSquare(bmp: ImageBitmap, crop: Crop): Promise<Blob> {
  return encodeUnder(
    (size) => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      drawSquare(canvas.getContext("2d")!, bmp, crop, size);
      return canvas;
    },
    640,
    300 * 1024
  );
}

/** Chat photo: max 1280px on the longest side, WebP, under 400KB. EXIF/GPS is dropped by the canvas re-encode. */
export async function compressMessageImage(file: File): Promise<Blob> {
  assertImage(file);
  const bmp = await decode(file);
  const scale = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
  const w0 = Math.round(bmp.width * scale), h0 = Math.round(bmp.height * scale);
  const blob = await encodeUnder(
    (size) => {
      const k = Math.min(1, size / 1280);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(w0 * k));
      canvas.height = Math.max(1, Math.round(h0 * k));
      canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
      return canvas;
    },
    1280,
    400 * 1024
  );
  bmp.close();
  return blob;
}
