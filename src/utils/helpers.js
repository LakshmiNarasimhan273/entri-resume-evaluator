

const norm = (s) => {
  if (s === null || s === undefined) return "";
  if (Array.isArray(s)) s = s.join(" ");
  if (typeof s === "object") {
    try {
      s = JSON.stringify(s);
    } catch (e) {
      s = String(s);
    }
  }
  return String(s).toLowerCase().replace(/\s+/g, " ").trim();
};
const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));
const esc = (s) =>
  String(s === null || s === undefined ? "" : s).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );

export { norm, clamp, esc };
