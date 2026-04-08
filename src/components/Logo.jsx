export default function Logo({ size = 40, showText = true, textSize = 20 }) {
  const s = size;
  const cx = s / 2;
  const cy = s / 2;
  const r = s * 0.27;

  const nodes = [
    { x: cx - r * 0.8, y: cy - r * 1.1, r: s * 0.07, fill: '#1D9E75' },
    { x: cx, y: cy - r * 1.4, r: s * 0.055, fill: '#F2C94C' },
    { x: cx + r * 0.9, y: cy - r * 1.0, r: s * 0.07, fill: '#1D9E75' },
    { x: cx + r * 1.1, y: cy + r * 0.1, r: s * 0.055, fill: '#F2C94C' },
    { x: cx + r * 0.7, y: cy + r * 1.1, r: s * 0.065, fill: '#1D9E75' },
    { x: cx - r * 0.3, y: cy + r * 1.3, r: s * 0.055, fill: '#F2C94C' },
    { x: cx - r * 1.0, y: cy + r * 0.6, r: s * 0.065, fill: '#1D9E75' },
  ];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: showText ? 10 : 0 }}>
      <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
        {nodes.map((n, i) => (
          <line key={i} x1={n.x} y1={n.y} x2={cx} y2={cy}
            stroke="#185FA5" strokeWidth={s * 0.025} strokeLinecap="round" opacity="0.5" />
        ))}
        {nodes.map((n, i) => (
          <circle key={i} cx={n.x} cy={n.y} r={n.r} fill={n.fill} />
        ))}
        <circle cx={cx} cy={cy} r={s * 0.17} fill="#185FA5" opacity="0.15" />
        <circle cx={cx} cy={cy} r={s * 0.12} fill="#185FA5" opacity="0.25" />
        <circle cx={cx} cy={cy} r={s * 0.075} fill="white" />
        <circle cx={cx} cy={cy} r={s * 0.038} fill="#185FA5" />
      </svg>

      {showText && (
        <div>
          <div style={{ fontSize: textSize, fontWeight: 800, color: '#fff', letterSpacing: -0.5, lineHeight: 1 }}>
            Vendor<span style={{ color: '#F2C94C' }}>Net</span>
          </div>
        </div>
      )}
    </div>
  );
}