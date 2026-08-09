// Logo gereja — file app/image/logo-placeholder.webp (disajikan Next.js
// sebagai aset statis di /image/logo-placeholder.webp). Dipakai di navbar,
// footer, dan area admin dengan ukuran berbeda per konteks.
export default function ChurchLogo({ size = 42, className = '', style = {} }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/image/logo-placeholder.webp"
      alt="Logo GPI Eluzai"
      width={size}
      height={size}
      className={className}
      style={{
        display: 'block',
        objectFit: 'cover',
        borderRadius: 12,
        boxShadow: '0 4px 12px rgba(29, 78, 216, 0.25)',
        flexShrink: 0,
        ...style,
      }}
    />
  );
}
