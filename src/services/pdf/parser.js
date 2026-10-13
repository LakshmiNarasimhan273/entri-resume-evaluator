import { loadPdfJs, loadTesseract } from "./loadLibs.js";
import { uniq, detectEmail, detectPhone } from '../analysis/text.js';

function timeoutPromise(promise, ms, label = "Operation") {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out`)),
      ms,
    );
    Promise.resolve(promise).then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}
function ensureOCR() {
  return timeoutPromise(loadTesseract(), 20000, "OCR engine loading");
}
async function parseResume(file, { onStatus = () => {}, onPage = () => {} } = {}) {
  onStatus("Loading processing libraries...");
  const pdfjsLib = await loadPdfJs();

  onStatus("Reading PDF content...");
  const data = new Uint8Array(await file.arrayBuffer());
  let pdf;
  try {
    pdf = await pdfjsLib.getDocument({ data }).promise;
  } catch (e) {
    const name = e?.name || "";
    throw new Error(
      name === "PasswordException"
        ? "This PDF is password-protected. Remove the password and upload it again."
        : name === "InvalidPDFException"
          ? "This file is not a valid PDF."
          : `The PDF could not be opened (${e?.message || "unknown error"}).`,
    );
  }


  let Tesseract = null;
  const pages = [];
  let allText = "";

  for (let p = 1; p <= pdf.numPages; p++) {
    onStatus(`Creating camera copy of page ${p} of ${pdf.numPages}...`);

    const page = await pdf.getPage(p);
    const base = page.getViewport({ scale: 1 });
    const renderVp = page.getViewport({ scale: 1.9 });

    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(renderVp.width);
    canvas.height = Math.ceil(renderVp.height);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: renderVp }).promise;

    // Show the exact page image being reviewed.
    onPage({ page: p, src: canvas.toDataURL("image/jpeg", 0.85) });

    // PDF text/layout is always read first so evaluation can complete even if OCR is unavailable.
    const tc = await page.getTextContent();
    const pdfItems = tc.items
      .filter((i) => i.str && i.str.trim())
      .map((i) => {
        const style = tc.styles?.[i.fontName] || {};
        return {
          text: i.str.trim(),
          x: i.transform?.[4] || 0,
          y: base.height - (i.transform?.[5] || 0),
          w: i.width || 0,
          h: Math.abs(i.height || i.transform?.[3] || 0),
          font: (style.fontFamily || i.fontName || "").replace(
            /["']/g,
            "",
          ),
          source: "pdf",
        };
      });
    const pdfText = pdfItems.map((i) => i.text).join(" ");

    let annotations = [];
    try {
      annotations = await page.getAnnotations({ intent: "display" });
    } catch (e) {}
    const annotationUrls = annotations
      .filter((a) => a.subtype === "Link" && (a.url || a.unsafeUrl))
      .map((a) => a.url || a.unsafeUrl);

    // OCR is a fallback/cross-check, not a hard dependency.
    // We use it for scanned PDFs, sparse text layers, and page 1 when contact
    // details are not confidently found in the PDF text.
    let ocrText = "",
      ocrLines = [],
      headerOCR = "";
    const sparsePDF = pdfText.replace(/\s+/g, "").length < 180;
    const page1ContactWeak =
      p === 1 && (!detectEmail(pdfText) || !detectPhone(pdfText));
    const shouldOCR = sparsePDF || page1ContactWeak;

    if (shouldOCR) {
      try {
        if (!Tesseract) Tesseract = await ensureOCR();

        onStatus(`Cross-checking page ${p} visually...`);
        const result = await timeoutPromise(
          Tesseract.recognize(canvas, "eng"),
          18000,
          `Visual scan of page ${p}`,
        );

        ocrText = result?.data?.text || "";
        ocrLines = (result?.data?.lines || [])
          .map((l) => ({
            text: (l.text || "").trim(),
            x: l.bbox?.x0 || 0,
            y: l.bbox?.y0 || 0,
            w: (l.bbox?.x1 || 0) - (l.bbox?.x0 || 0),
            h: (l.bbox?.y1 || 0) - (l.bbox?.y0 || 0),
            font: "",
            source: "ocr",
            confidence: l.confidence || 0,
          }))
          .filter((l) => l.text && l.confidence >= 20);
      } catch (e) {
        console.warn(`OCR skipped for page ${p}:`, e);
      }
    }

    // Extra header crop only when page 1 contact info is still uncertain.
    if (
      p === 1 &&
      (!detectEmail(pdfText + " " + ocrText) ||
        !detectPhone(pdfText + " " + ocrText))
    ) {
      try {
        if (!Tesseract) Tesseract = await ensureOCR();
        const crop = document.createElement("canvas");
        crop.width = canvas.width;
        crop.height = Math.max(1, Math.floor(canvas.height * 0.38));
        const cctx = crop.getContext("2d", { willReadFrequently: true });
        cctx.fillStyle = "#fff";
        cctx.fillRect(0, 0, crop.width, crop.height);
        cctx.drawImage(
          canvas,
          0,
          0,
          canvas.width,
          crop.height,
          0,
          0,
          crop.width,
          crop.height,
        );

        const hocr = await timeoutPromise(
          Tesseract.recognize(crop, "eng"),
          12000,
          "Header visual scan",
        );
        headerOCR = hocr?.data?.text || "";
      } catch (e) {
        console.warn("Header OCR skipped:", e);
      }
    }

    const combinedText = [pdfText, ocrText, headerOCR]
      .filter(Boolean)
      .join(" ");
    const visibleUrls =
      combinedText.match(
        /(?:https?:\/\/|www\.)[^\s|,)]+|(?:github\.com|linkedin\.com|leetcode\.com|behance\.net|dribbble\.com|vercel\.app|netlify\.app|onrender\.com|pages\.dev|firebaseapp\.com|web\.app)\/[^\s|,)]+/gi,
      ) || [];

    const ys = ocrLines.length
      ? ocrLines.map((i) => i.y)
      : pdfItems.map((i) => i.y);
    const hBase = ocrLines.length ? canvas.height : base.height;
    const fillRatio = ys.length
      ? Math.min(
          1,
          ((Math.max(...ys) - Math.min(...ys)) / (hBase || 1)) * 1.12,
        )
      : 0;

    pages.push({
      page: p,
      text: combinedText,
      pdfText,
      ocrText,
      headerOCR,
      pdfItems,
      ocrLines,
      baseHeight: base.height,
      cameraHeight: canvas.height,
      width: base.width,
      fillRatio,
      urls: uniq([...annotationUrls, ...visibleUrls]),
    });

    allText += "\n" + combinedText;
  }

  if (!allText.trim()) {
    throw new Error(
      "No readable text could be obtained from the resume.",
    );
  }

  return {
    pages,
    pageCount: pdf.numPages,
    text: allText,
    urls: uniq(pages.flatMap((p) => p.urls || [])),
  };
}

export { timeoutPromise, ensureOCR, parseResume };
