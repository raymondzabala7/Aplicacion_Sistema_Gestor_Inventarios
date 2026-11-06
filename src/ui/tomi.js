// Tomi, la mascota en SVG. Tres estados: feliz, preocupado y celebrando con diseño kawaii mejorado.
export function tomi(estado = 'feliz', clase = '') {
  const boca = {
    feliz: '<path d="M68 114 Q80 126 92 114" stroke="#1C0D0A" stroke-width="3.5" fill="none" stroke-linecap="round"/>',
    preocupado: '<path d="M68 120 Q80 110 92 120" stroke="#1C0D0A" stroke-width="3.5" fill="none" stroke-linecap="round"/>',
    celebrando: '<path d="M66 112 Q80 134 94 112 Z" fill="#6A1616"/><path d="M72 120 Q80 127 88 120" fill="#FFA5B5"/>',
  }[estado] || '<path d="M68 114 Q80 126 92 114" stroke="#1C0D0A" stroke-width="3.5" fill="none" stroke-linecap="round"/>';

  const cejas = {
    feliz: '<path d="M54 78 Q62 74 70 80" stroke="#1C0D0A" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M90 80 Q98 74 106 78" stroke="#1C0D0A" stroke-width="2.5" fill="none" stroke-linecap="round"/>',
    preocupado: '<path d="M52 74 L70 82" stroke="#1C0D0A" stroke-width="3" stroke-linecap="round"/><path d="M108 74 L90 82" stroke="#1C0D0A" stroke-width="3" stroke-linecap="round"/>',
    celebrando: '<path d="M52 76 Q62 70 72 78" stroke="#1C0D0A" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M88 78 Q98 70 108 76" stroke="#1C0D0A" stroke-width="3" fill="none" stroke-linecap="round"/>',
  }[estado];

  const brazos = estado === 'celebrando'
    ? `<g class="tomi-brazo izq"><ellipse cx="24" cy="68" rx="8" ry="14" fill="#E0301C" transform="rotate(-40 24 68)"/></g>
       <g class="tomi-brazo der"><ellipse cx="136" cy="68" rx="8" ry="14" fill="#E0301C" transform="rotate(40 136 68)"/></g>`
    : `<g class="tomi-brazo izq"><ellipse cx="22" cy="108" rx="7" ry="12" fill="#E0301C" transform="rotate(-15 22 108)"/></g>
       <g class="tomi-brazo der"><ellipse cx="138" cy="108" rx="7" ry="12" fill="#E0301C" transform="rotate(15 138 108)"/></g>`;

  const confeti = estado === 'celebrando'
    ? `<g class="tomi-confeti">
        <circle cx="20" cy="24" r="5" fill="#FFC94A"/>
        <polygon points="134,18 138,28 128,26" fill="#5DB547"/>
        <rect x="140" y="44" width="7" height="7" rx="2" fill="#FF6247" transform="rotate(25 143 47)"/>
        <circle cx="18" cy="52" r="4" fill="#3B82F6"/>
        <polygon points="30,8 34,16 26,14" fill="#E11D48"/>
        <circle cx="146" cy="12" r="3.5" fill="#A855F7"/>
       </g>`
    : estado === 'preocupado'
      ? '<path d="M128 72 C134 84 128 92 122 88 C116 84 122 76 128 72 Z" fill="#60A5FA"/>'
      : '';

  return `<svg class="tomi tomi-${estado} ${clase}" viewBox="0 0 160 170" role="img" aria-label="Tomi ${estado}">
    <defs>
      <radialGradient id="tomiBodyGrad" cx="38%" cy="32%" r="65%">
        <stop offset="0%" stop-color="#FF5A43"/>
        <stop offset="60%" stop-color="#E22E1B"/>
        <stop offset="100%" stop-color="#A11306"/>
      </radialGradient>
      <linearGradient id="tomiLeafGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#5DB547"/>
        <stop offset="100%" stop-color="#2F7D2A"/>
      </linearGradient>
    </defs>
    ${confeti}
    <g class="tomi-cuerpo">
      <!-- Sombra en suelo -->
      <ellipse cx="80" cy="156" rx="46" ry="8" fill="#1C0D0A" opacity=".18"/>
      
      <!-- Patitas -->
      <ellipse cx="60" cy="148" rx="13" ry="10" fill="#B31A0B"/>
      <ellipse cx="100" cy="148" rx="13" ry="10" fill="#B31A0B"/>
      
      <!-- Corona de hojas -->
      <g fill="url(#tomiLeafGrad)">
        <path d="M80 34 C68 14 90 6 96 18 C86 20 84 26 80 34 Z"/>
        <path d="M80 34 C84 14 62 8 56 20 C66 20 74 26 80 34 Z"/>
        <path d="M80 34 C100 28 108 40 98 48 C92 42 86 38 80 34 Z"/>
        <path d="M80 34 C60 28 52 40 62 48 C68 42 74 38 80 34 Z"/>
        <path d="M80 34 C76 48 84 48 80 34 Z"/>
      </g>
      <!-- Tallo de madera -->
      <path d="M78 26 C76 16 83 10 87 6 C89 12 84 18 82 26 Z" fill="#6B4A28"/>

      <!-- Cuerpo Tomate -->
      <ellipse cx="80" cy="98" rx="60" ry="54" fill="url(#tomiBodyGrad)"/>
      
      <!-- Brillo tierno en frente -->
      <ellipse cx="58" cy="72" rx="14" ry="7" fill="#FFFFFF" opacity=".38" transform="rotate(-15 58 72)"/>
      <ellipse cx="52" cy="68" rx="5" ry="2.5" fill="#FFFFFF" opacity=".6" transform="rotate(-15 52 68)"/>

      <!-- Cejas -->
      ${cejas}

      <!-- Ojos grandes y adorables -->
      <g class="tomi-ojos">
        <ellipse cx="58" cy="94" rx="8" ry="10" fill="#1C0D0A"/>
        <ellipse cx="102" cy="94" rx="8" ry="10" fill="#1C0D0A"/>
        <!-- Destellos en ojos -->
        <circle cx="61" cy="90" r="3" fill="#FFFFFF"/>
        <circle cx="56" cy="98" r="1.5" fill="#FFFFFF"/>
        <circle cx="105" cy="90" r="3" fill="#FFFFFF"/>
        <circle cx="100" cy="98" r="1.5" fill="#FFFFFF"/>
      </g>

      <!-- Mejillas sonrosadas -->
      <ellipse cx="44" cy="110" rx="9" ry="6" fill="#FFA5B5" opacity=".85"/>
      <ellipse cx="116" cy="110" rx="9" ry="6" fill="#FFA5B5" opacity=".85"/>

      <!-- Sonrisa / Expresión -->
      ${boca}

      <!-- Bracitos -->
      ${brazos}
    </g>
  </svg>`;
}
