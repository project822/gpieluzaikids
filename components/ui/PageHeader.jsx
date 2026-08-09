export default function PageHeader({ title, sub }) {
  return (
    <section className="page-header">
      <div className="container">
        <h1 className="section-title" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}>
          {title}
        </h1>
        {sub && <p className="section-sub mt-3 mb-0">{sub}</p>}
      </div>
    </section>
  );
}
