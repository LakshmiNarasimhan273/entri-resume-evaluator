import { useCallback, useState } from "react";
import { runEvaluation } from "../services/runEvaluation.js";

/** Owns the evaluation lifecycle: busy flag, status text, page previews and result. */
export function useResumeEvaluation() {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [pages, setPages] = useState([]);
  const [result, setResult] = useState(null);

  const evaluate = useCallback(async (file, options) => {
    if (!file) {
      setStatus("Please upload a PDF resume.");
      return false;
    }
    setBusy(true);
    setResult(null);
    setPages([]);
    try {
      const res = await runEvaluation(file, options, {
        onStatus: setStatus,
        onPage: (p) => setPages((prev) => [...prev, p]),
      });
      setResult(res);
      setStatus("Evaluation complete.");
      return true;
    } catch (e) {
      console.error("Resume evaluation failed:", e);
      setStatus(`Evaluation could not be completed: ${e?.message || "Unknown processing error"}.`);
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  return { busy, status, pages, result, evaluate };
}
