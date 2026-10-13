import { useState } from "react";

export default function CopyButton({ text }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1200);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <button className="btn copy" onClick={copy}>
      {done ? "Copied" : "Copy"}
    </button>
  );
}
