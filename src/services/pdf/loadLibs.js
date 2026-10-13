/**
 * Library loading for PDF reading and OCR.
 *
 * Primary path: load the standard (non-module) bundles from the CDN, as a plain <script>,
 * which avoids ES-module import problems:
 *   - pdf.js 3.11.174  -> window.pdfjsLib
 *   - tesseract.js 5   -> window.Tesseract
 * Fallback: the copies bundled with this app, used when a CDN is blocked or offline.
 */
const PDFJS_VERSION = "3.11.174";
const PDFJS_SRC = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.js`;
const PDFJS_WORKER = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;
const TESSERACT_SRC = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";

export function loadScript(src, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-lib-src="${src}"]`);
    if (existing?.dataset.loaded === "1") return resolve();
    const s = existing || document.createElement("script");
    const timer = setTimeout(() => reject(new Error(`Timed out loading ${src}`)), timeoutMs);
    s.addEventListener("load", () => {
      clearTimeout(timer);
      s.dataset.loaded = "1";
      resolve();
    });
    s.addEventListener("error", () => {
      clearTimeout(timer);
      s.remove();
      reject(new Error(`Could not load ${src}`));
    });
    if (!existing) {
      s.src = src;
      s.async = true;
      s.dataset.libSrc = src;
      document.head.appendChild(s);
    }
  });
}

let pdfPromise = null;
export function loadPdfJs() {
  if (pdfPromise) return pdfPromise;
  pdfPromise = (async () => {
    try {
      await loadScript(PDFJS_SRC);
      const lib = window.pdfjsLib || window["pdfjs-dist/build/pdf"];
      if (!lib) throw new Error("PDF.js library failed to load properly from CDN.");
      lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
      return lib;
    } catch (cdnError) {
      console.warn("PDF.js CDN unavailable, using bundled copy:", cdnError);
      const [lib, worker] = await Promise.all([
        import("pdfjs-dist/legacy/build/pdf.mjs"),
        import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url"),
      ]);
      lib.GlobalWorkerOptions.workerSrc = worker.default;
      return lib;
    }
  })();
  pdfPromise.catch(() => (pdfPromise = null));
  return pdfPromise;
}

export async function loadTesseract() {
  if (window.Tesseract) return window.Tesseract;
  try {
    await loadScript(TESSERACT_SRC, 8000);
    if (window.Tesseract) return window.Tesseract;
    throw new Error("OCR engine unavailable");
  } catch (cdnError) {
    console.warn("Tesseract CDN unavailable, using bundled copy:", cdnError);
    const mod = await import("tesseract.js");
    return mod.default || mod;
  }
}
