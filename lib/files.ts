/**
 * Client-side text extraction for common document types. All parsers are
 * dynamically imported so they stay out of the main bundle. Returns plain text
 * the model can read, plus a coarse "type" label for the UI.
 */

const TEXT_CAP = 200_000;

function cap(t: string): string {
  return t.length > TEXT_CAP ? t.slice(0, TEXT_CAP) + "\n[document truncated]" : t;
}

export type ExtractResult = { text: string; type: "docx" | "xlsx" | "pptx" | "text" };

/** True for the non-PDF document types this module handles. */
export function isSupportedDoc(file: File): boolean {
  const n = file.name.toLowerCase();
  return /\.(docx|xlsx|xls|csv|pptx|txt|md|json|log|rtf)$/.test(n);
}

export async function extractFileText(file: File): Promise<ExtractResult> {
  const n = file.name.toLowerCase();

  if (n.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return { text: cap(value.trim()), type: "docx" };
  }

  if (n.endsWith(".xlsx") || n.endsWith(".xls") || n.endsWith(".csv")) {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
    let text = "";
    for (const name of wb.SheetNames) {
      text += `--- Sheet: ${name} ---\n` + XLSX.utils.sheet_to_csv(wb.Sheets[name]) + "\n\n";
    }
    return { text: cap(text.trim()), type: "xlsx" };
  }

  if (n.endsWith(".pptx")) {
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const slides = Object.keys(zip.files)
      .filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))
      .sort((a, b) => (parseInt(a.match(/(\d+)/)?.[1] ?? "0") - parseInt(b.match(/(\d+)/)?.[1] ?? "0")));
    let text = "";
    let i = 0;
    for (const f of slides) {
      i++;
      const xml = await zip.files[f].async("text");
      const t = (xml.match(/<a:t>([^<]*)<\/a:t>/g) ?? []).map((m) => m.replace(/<[^>]+>/g, "")).join(" ");
      if (t.trim()) text += `--- Slide ${i} ---\n${t}\n\n`;
    }
    return { text: cap(text.trim()), type: "pptx" };
  }

  // txt / md / csv-ish / code / plain
  return { text: cap((await file.text()).trim()), type: "text" };
}
