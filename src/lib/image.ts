// Client-side image downscaling so food-photo uploads stay well under the
// serverless request-body limit (and cost less to send to the vision model).

export interface EncodedImage {
  mediaType: string;
  data: string; // base64, no data: prefix
}

/**
 * Load a File, downscale so the long edge is at most `maxEdge` px, and return
 * base64 JPEG. Falls back to the original bytes if canvas isn't available.
 */
export async function downscaleImage(file: File, maxEdge = 1024, quality = 0.8): Promise<EncodedImage> {
  const dataUrl = await readAsDataURL(file);
  const img = await loadImage(dataUrl);

  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    // Fallback: send the original file bytes.
    const [, base64] = dataUrl.split(",");
    return { mediaType: file.type || "image/jpeg", data: base64 };
  }
  ctx.drawImage(img, 0, 0, w, h);
  const out = canvas.toDataURL("image/jpeg", quality);
  return { mediaType: "image/jpeg", data: out.split(",")[1] };
}

/**
 * Capture the current frame of a playing <video> element, downscale it the same
 * way as file uploads, and return base64 JPEG. Used by the live camera capture.
 */
export function encodeVideoFrame(
  video: HTMLVideoElement,
  maxEdge = 1024,
  quality = 0.8,
): EncodedImage {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const scale = Math.min(1, maxEdge / Math.max(vw, vh));
  const w = Math.round(vw * scale);
  const h = Math.round(vh * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not capture the camera frame.");
  ctx.drawImage(video, 0, 0, w, h);
  const out = canvas.toDataURL("image/jpeg", quality);
  return { mediaType: "image/jpeg", data: out.split(",")[1] };
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read the image file."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load the image."));
    img.src = src;
  });
}
