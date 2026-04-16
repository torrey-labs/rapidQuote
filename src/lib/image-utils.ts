/**
 * Client-side image utilities. These use DOM APIs (Canvas, Image) so they
 * must only be imported from 'use client' modules.
 */

export async function resizeImage(
  file: File,
  maxEdge = 2048,
  quality = 0.85,
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;

  let targetW = width;
  let targetH = height;

  if (width > maxEdge || height > maxEdge) {
    const ratio = maxEdge / Math.max(width, height);
    targetW = Math.round(width * ratio);
    targetH = Math.round(height * ratio);
  }

  const canvas = new OffscreenCanvas(targetW, targetH);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);
  bitmap.close();

  return canvas.convertToBlob({ type: "image/jpeg", quality });
}

export function getSvgPathFromStroke(points: number[][]): string {
  if (points.length === 0) return "";

  const d = points.reduce(
    (acc, [x, y], i, arr) => {
      if (i === 0) return `M ${x.toFixed(2)},${y.toFixed(2)}`;
      const [mx, my] = [
        (x + arr[i - 1][0]) / 2,
        (y + arr[i - 1][1]) / 2,
      ];
      return `${acc} Q ${arr[i - 1][0].toFixed(2)},${arr[i - 1][1].toFixed(2)} ${mx.toFixed(2)},${my.toFixed(2)}`;
    },
    "",
  );

  return `${d} Z`;
}

export async function flattenCanvasToBlob(
  bgImage: HTMLImageElement,
  svgElement: SVGSVGElement,
): Promise<Blob> {
  const { naturalWidth: w, naturalHeight: h } = bgImage;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  ctx.drawImage(bgImage, 0, 0, w, h);

  const svgClone = svgElement.cloneNode(true) as SVGSVGElement;
  svgClone.setAttribute("width", String(w));
  svgClone.setAttribute("height", String(h));
  svgClone.setAttribute("viewBox", `0 0 ${w} ${h}`);

  const svgData = new XMLSerializer().serializeToString(svgClone);
  const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  try {
    const svgImg = await loadImage(url);
    ctx.drawImage(svgImg, 0, 0, w, h);
  } finally {
    URL.revokeObjectURL(url);
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas toBlob failed"))),
      "image/jpeg",
      0.9,
    );
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
