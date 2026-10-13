export default function PagePreview({ pages }) {
  if (!pages.length) return null;
  return (
    <section className="card preview">
      <h3>Page-by-page camera copy used for evaluation</h3>
      <div className="pages">
        {pages.map((p) => (
          <div className="pagecard" key={p.page}>
            <img src={p.src} alt={`Page ${p.page}`} />
            <div className="pagecap">Page {p.page} • camera copy</div>
          </div>
        ))}
      </div>
    </section>
  );
}
