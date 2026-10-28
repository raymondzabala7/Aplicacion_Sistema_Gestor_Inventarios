// Tomi, la mascota. Tres estados: feliz, preocupado y celebrando.
export function tomi(estado = 'feliz', clase = '') {
  const boca = {
    feliz: '<path d="M70 112 Q80 123 90 112" stroke="#1B1B1B" stroke-width="4" fill="none" stroke-linecap="round"/>',
    preocupado: '<path d="M70 118 Q80 109 90 118" stroke="#1B1B1B" stroke-width="4" fill="none" stroke-linecap="round"/>',
    celebrando: '<path d="M68 110 Q80 132 92 110 Z" fill="#7A1F1F"/><path d="M73 117 Q80 124 87 117" fill="#FF8FA0"/>',
  }[estado];
  const cejas = estado === 'preocupado'
    ? '<path d="M50 76 L68 82" stroke="#1B1B1B" stroke-width="4" stroke-linecap="round"/><path d="M110 76 L92 82" stroke="#1B1B1B" stroke-width="4" stroke-linecap="round"/>'
    : '';
  const brazos = estado === 'celebrando'
    ? '<rect x="14" y="60" width="16" height="10" rx="5" fill="#FF6B4A" transform="rotate(-60 22 65)"/><rect x="130" y="60" width="16" height="10" rx="5" fill="#FF6B4A" transform="rotate(60 138 65)"/>'
    : '<rect x="18" y="104" width="16" height="10" rx="5" fill="#FF6B4A" transform="rotate(-30 26 109)"/><rect x="126" y="104" width="16" height="10" rx="5" fill="#FF6B4A" transform="rotate(30 134 109)"/>';
  const extra = estado === 'celebrando'
    ? '<g class="tomi-confeti"><rect x="20" y="20" width="8" height="8" rx="2" fill="#FFC94A" transform="rotate(20 24 24)"/><rect x="130" y="30" width="8" height="8" rx="2" fill="#46C285" transform="rotate(-15 134 34)"/><circle cx="140" cy="10" r="4" fill="#3B7DD8"/><circle cx="16" cy="48" r="4" fill="#D93E62"/></g>'
    : estado === 'preocupado'
      ? '<path d="M126 70 Q132 82 126 86 Q120 82 126 70Z" fill="#7CC6F2"/>'
      : '';
  return `<svg class="tomi tomi-${estado} ${clase}" viewBox="0 0 160 170" role="img" aria-label="Tomi ${estado}">
    ${extra}
    <g class="tomi-cuerpo">
      <path d="M80 30 C70 10 92 4 96 14 C88 14 84 22 80 30Z" fill="#2FA866"/>
      <path d="M80 30 C82 14 66 8 60 16 C68 16 74 22 80 30Z" fill="#46C285"/>
      <rect x="76" y="22" width="6" height="14" rx="3" fill="#6B4A2B"/>
      <ellipse cx="80" cy="96" rx="62" ry="58" fill="#FF6B4A"/>
      <ellipse cx="58" cy="70" rx="14" ry="9" fill="#FFFFFF" opacity=".35"/>
      ${cejas}
      <g class="tomi-ojos">
        <ellipse cx="60" cy="92" rx="8" ry="10" fill="#1B1B1B"/><ellipse cx="100" cy="92" rx="8" ry="10" fill="#1B1B1B"/>
        <circle cx="63" cy="88" r="3" fill="#FFFFFF"/><circle cx="103" cy="88" r="3" fill="#FFFFFF"/>
      </g>
      <ellipse cx="44" cy="110" rx="9" ry="5" fill="#FF9FB0"/><ellipse cx="116" cy="110" rx="9" ry="5" fill="#FF9FB0"/>
      ${boca}
      ${brazos}
      <rect x="56" y="146" width="16" height="16" rx="8" fill="#E2553A"/><rect x="88" y="146" width="16" height="16" rx="8" fill="#E2553A"/>
    </g>
  </svg>`;
}
