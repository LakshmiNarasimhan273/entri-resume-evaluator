export default function BackToTop() {
  return (
    <button className="btn back-top" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
      ↑ Back to top
    </button>
  );
}
