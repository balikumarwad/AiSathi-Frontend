/**
 * Client-side PDF text extraction via pdf.js. Dynamically imported so it never
 * touches the server bundle; the worker is self-hosted at /pdf.worker.min.mjs
 * (copied from pdfjs-dist at the matching version).
 */

export async function extractPdfText(file: File): Promise<{ text: string; pages: number }> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const pages = doc.numPages;
  let text = "";
  for (let i = 1; i <= pages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const line = content.items.map((it) => (it as { str?: string }).str ?? "").join(" ");
    text += line + "\n\n";
    // Bound very large PDFs so a single attachment can't blow the model context.
    if (text.length > 120_000) { text += "\n[document truncated]"; break; }
  }
  return { text: text.trim(), pages };
}
