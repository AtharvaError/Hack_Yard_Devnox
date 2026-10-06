import exifr from "exifr";

export type PhotoMeta = { taken_at: string | null; lat: number | null; lon: number | null };
export type PreparedPhoto = { id: string; blob: Blob; preview: string; meta: PhotoMeta };

const MAX_SIDE = 1600;

/** When and where the photo was taken, if the camera recorded it. Missing metadata is normal. */
async function readMeta(file: File): Promise<PhotoMeta> {
  try {
    const exif = await exifr.parse(file);
    const taken = exif?.DateTimeOriginal ?? exif?.CreateDate;
    return {
      taken_at: taken instanceof Date && !Number.isNaN(taken.getTime()) ? taken.toISOString() : null,
      lat: typeof exif?.latitude === "number" ? exif.latitude : null,
      lon: typeof exif?.longitude === "number" ? exif.longitude : null,
    };
  } catch {
    return { taken_at: null, lat: null, lon: null };
  }
}

/**
 * Reads the photo's time and place, then shrinks it. Redrawing on a canvas keeps only the pixels,
 * so the upload is small and carries no hidden data.
 */
export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  const meta = await readMeta(file);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error(`"${file.name}" is not a photo this browser can read. Use a JPEG, PNG or WebP image.`);
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) throw new Error(`"${file.name}" could not be prepared for upload.`);
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return { id, blob, preview: URL.createObjectURL(blob), meta };
}
