// Client-only export helpers for proposals and messages.

export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
}

function safeFilename(name: string): string {
  return (
    (name || "proposal")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "proposal"
  );
}

export function downloadTxt(filename: string, text: string): void {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeFilename(filename)}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function downloadPdf(title: string, text: string): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 56;
  const contentW = pageW - margin * 2;
  let y = margin;

  // Header band
  doc.setFillColor(10, 15, 26);
  doc.rect(0, 0, pageW, 86, "F");
  doc.setTextColor(201, 168, 76);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("XPERIENCE PROPS", margin, 38);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  const heading = title?.trim() || "Proposal";
  doc.text(doc.splitTextToSize(heading, contentW), margin, 62);

  y = 120;
  doc.setTextColor(28, 32, 44);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);

  const paragraphs = text.split(/\n{1,}/);
  const lineHeight = 16;
  for (const para of paragraphs) {
    const lines = doc.splitTextToSize(para.trim() === "" ? " " : para, contentW) as string[];
    for (const line of lines) {
      if (y > pageH - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += lineHeight;
    }
    y += 6;
  }

  doc.save(`${safeFilename(title)}.pdf`);
}

/**
 * Captures a DOM element (including all SVG diagrams, CSS variables, and modern
 * CSS) as a high-res image and saves it as a multi-page PDF.
 * Uses html-to-image which handles Tailwind CSS variables and inline SVGs correctly.
 */
export async function downloadElementAsPdf(
  element: HTMLElement,
  filename: string,
): Promise<void> {
  const { toPng } = await import("html-to-image");
  const { jsPDF } = await import("jspdf");

  // Snapshot the element at 2× for retina sharpness
  const dataUrl = await toPng(element, {
    pixelRatio: 2,
    backgroundColor: "#0a0f14",
    skipFonts: false,
    cacheBust: true,
  });

  // Decode image to get real pixel dimensions
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = dataUrl;
  });
  const imgW = img.naturalWidth;
  const imgH = img.naturalHeight;

  // A4 in pt: 595 × 842
  const pageW = 595;
  const pageH = 842;
  const margin = 28;
  const printW = pageW - margin * 2;
  const scale = printW / imgW;

  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });

  const topOffset = 58; // space below header on page 1
  const usableFirstPage = pageH - topOffset - margin;
  const usableSubPage = pageH - margin * 2;

  // Draw a horizontal strip of the source image as one PDF page
  async function addPageWithStrip(yPx: number, heightPx: number, isFirst: boolean) {
    const stripCanvas = document.createElement("canvas");
    stripCanvas.width = imgW;
    stripCanvas.height = heightPx;
    const ctx = stripCanvas.getContext("2d")!;
    ctx.drawImage(img, 0, yPx, imgW, heightPx, 0, 0, imgW, heightPx);
    const strip = stripCanvas.toDataURL("image/png");
    const stripPrintH = heightPx * scale;

    doc.addPage();
    if (isFirst) {
      doc.setFillColor(10, 15, 26);
      doc.rect(0, 0, pageW, 50, "F");
      doc.setTextColor(201, 168, 76);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text("XPERIENCE PROPS", margin, 22);
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(13);
      doc.text((filename || "Strategy Document").slice(0, 80), margin, 40);
      doc.addImage(strip, "PNG", margin, topOffset, printW, stripPrintH);
    } else {
      doc.addImage(strip, "PNG", margin, margin, printW, stripPrintH);
    }
  }

  let srcY = 0;
  const firstStripPx = Math.floor(usableFirstPage / scale);
  await addPageWithStrip(srcY, Math.min(firstStripPx, imgH), true);
  srcY += firstStripPx;

  const subStripPx = Math.floor(usableSubPage / scale);
  while (srcY < imgH) {
    const h = Math.min(subStripPx, imgH - srcY);
    await addPageWithStrip(srcY, h, false);
    srcY += subStripPx;
  }

  // jsPDF always creates a blank page 1 — remove it
  doc.deletePage(1);

  doc.save(`${safeFilename(filename)}.pdf`);
}

