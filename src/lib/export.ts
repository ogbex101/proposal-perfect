// Client-only export helpers for proposals and messages.

export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  // Fallback for older browsers / insecure contexts
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
  doc.setFillColor(10, 15, 26); // navy
  doc.rect(0, 0, pageW, 86, "F");
  doc.setTextColor(201, 168, 76); // gold
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
    y += 6; // paragraph gap
  }

  doc.save(`${safeFilename(title)}.pdf`);
}
