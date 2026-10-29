/**
 * Client-side PDF handling via pdf.js (text + rasterise) and OCR via
 * tesseract.js. All dynamically imported so they never touch the server bundle;
 * the pdf.js worker is self-hosted at /pdf.worker.min.mjs.
 */

const TEXT_CAP = 200_000; // ~50k tokens — bounds a single attachment's context

export async function extractPdfText(file: File): Promise<{ text: string; pages: number; scanned: boolean }> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const pages = doc.numPages;
  let text = "";
  for (let i = 1; i <= pages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((it) => (it as { str?: string }).str ?? "").join(" ") + "\n\n";
    if (text.length > TEXT_CAP) { text += "\n[document truncated]"; break; }
  }
  const trimmed = text.trim();
  // Very little text for the page count => likely a scan that needs OCR.
  const scanned = trimmed.length < Math.min(40 * pages, 200);
  return { text: trimmed, pages, scanned };
}

/** OCR a scanned PDF by rasterising pages and running Tesseract. Capped for speed. */
export async function ocrPdf(
  file: File,
  maxPages = 15,
  onProgress?: (page: number, pages: number) => void,
): Promise<{ text: string; pages: number }> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const { recognize } = await import("tesseract.js");
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const pages = Math.min(doc.numPages, maxPages);
  let text = "";
  for (let i = 1; i <= pages; i++) {
    onProgress?.(i, pages);
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    await page.render({ canvas, canvasContext: ctx, viewport } as Parameters<typeof page.render>[0]).promise;
    const { data } = await recognize(canvas, "eng");
    text += (data.text || "") + "\n\n";
    if (text.length > TEXT_CAP) break;
  }
  return { text: text.trim(), pages: doc.numPages };
}

/** OCR a single image (data URL or blob URL). */
export async function ocrImage(src: string, onProgress?: (pct: number) => void): Promise<string> {
  const { recognize } = await import("tesseract.js");
  const { data } = await recognize(src, "eng", {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text" && onProgress) onProgress(Math.round(m.progress * 100));
    },
  });
  return (data.text || "").trim();
}

/** Read a File as a data URL (for rendering PDFs in the side panel). */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
