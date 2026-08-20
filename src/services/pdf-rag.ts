import prisma from "@/lib/prisma";

export interface PDFDocumentContent {
  documentId: string;
  name: string;
  url: string;
  extractedText: string;
  personName?: string;
  caseTitle?: string;
}

export async function extractTextFromPDFBuffer(buffer: Buffer): Promise<string> {
  try {
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

    if (pdfjsLib.GlobalWorkerOptions) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = "";
    }

    const uint8Array = new Uint8Array(buffer);
    const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
    const pdfDoc = await loadingTask.promise;

    let fullText = "";
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str || "")
        .join(" ");
      fullText += `--- PÁGINA ${i} ---\n${pageText}\n\n`;
    }

    return fullText.trim();
  } catch (err) {
    console.warn("⚠️ Fallback de extracción de PDF a texto llano:", err);
    return buffer.toString("utf-8").replace(/[^\x20-\x7E\n\r\t]/g, " ").trim();
  }
}

export async function searchPDFDocumentsForRAG(
  query: string,
  personId?: string,
  caseId?: string
): Promise<PDFDocumentContent[]> {
  const cleanQuery = query.toLowerCase();

  const documents = await prisma.document.findMany({
    where: {
      OR: [
        personId ? { personId } : {},
        caseId ? { caseId } : {},
        { fileType: { contains: "pdf", mode: "insensitive" } },
        { name: { contains: "pdf", mode: "insensitive" } },
        { name: { contains: "informe", mode: "insensitive" } },
        { name: { contains: "ordenanza", mode: "insensitive" } },
        { name: { contains: "decreto", mode: "insensitive" } },
      ].filter(condition => Object.keys(condition).length > 0)
    },
    include: {
      person: true,
      case: true
    },
    take: 5,
    orderBy: { createdAt: "desc" }
  });

  const results: PDFDocumentContent[] = [];

  for (const doc of documents) {
    const personName = doc.person ? `${doc.person.lastName}, ${doc.person.firstName}` : undefined;
    const caseTitle = doc.case ? doc.case.title : undefined;

    results.push({
      documentId: doc.id,
      name: doc.name,
      url: doc.url,
      extractedText: `Documento: ${doc.name}\nRelacionado con: ${personName || caseTitle || "General"}\n` +
        `Fecha de Carga: ${new Date(doc.createdAt).toLocaleDateString("es-AR")}\n` +
        `Estado: Documento oficialmente registrado en el legajo municipal.`,
      personName,
      caseTitle
    });
  }

  return results;
}
