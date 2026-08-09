export default function SectionHeading({ title, sub, center = false }) {
  return (
    <div className={`mb-4 ${center ? 'text-center mx-auto' : ''}`} style={{ maxWidth: center ? 680 : 720 }}>
      <h2 className="section-title">{title}</h2>
      {sub && (
        <p className={`section-sub mt-3 ${center ? 'mx-auto' : ''}`} style={center ? { marginInline: 'auto' } : {}}>
          {sub}
        </p>
      )}
    </div>
  );
}
