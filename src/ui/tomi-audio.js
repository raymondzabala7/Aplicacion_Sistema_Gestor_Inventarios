// Sistema de Audio y Voz para Tomi (la mascota de FrescoStock)
// Efectos de sonido con Web Audio API sintetizado y voz con SpeechSynthesis.

let audioCtx = null;

function getAudioContext() {
  if (!audioCtx && (window.AudioContext || window.webkitAudioContext)) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioCtx();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function sonidoHabilitado() {
  return localStorage.getItem('frescostock_tomi_sonido') !== 'false';
}

export function alternarSonido() {
  const actual = sonidoHabilitado();
  const nuevo = !actual;
  localStorage.setItem('frescostock_tomi_sonido', nuevo ? 'true' : 'false');
  if (nuevo) {
    sonidoPop();
  }
  return nuevo;
}

// Sonido tierno de campanitas/fanfarria kawaii al entrar y saludar
export function sonidoSaludo() {
  if (!sonidoHabilitado()) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const ahora = ctx.currentTime;
  const notas = [523.25, 659.25, 783.99]; // Do5, Mi5, Sol5
  notas.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, ahora + i * 0.09);
    gain.gain.setValueAtTime(0.001, ahora + i * 0.09);
    gain.gain.linearRampToValueAtTime(0.2, ahora + i * 0.09 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ahora + i * 0.09 + 0.24);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ahora + i * 0.09);
    osc.stop(ahora + i * 0.09 + 0.25);
  });
}

// Pop kawaii al hablar o mostrar un comentario
export function sonidoPop() {
  if (!sonidoHabilitado()) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const ahora = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(460, ahora);
  osc.frequency.exponentialRampToValueAtTime(780, ahora + 0.08);
  gain.gain.setValueAtTime(0.16, ahora);
  gain.gain.exponentialRampToValueAtTime(0.001, ahora + 0.13);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ahora);
  osc.stop(ahora + 0.14);
}

// Risitas de cosquillas cuando se hace clic en Tomi
export function sonidoCosquillas() {
  if (!sonidoHabilitado()) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const ahora = ctx.currentTime;
  const freqs = [640, 840, 1020];
  freqs.forEach((f, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f, ahora + i * 0.06);
    gain.gain.setValueAtTime(0.14, ahora + i * 0.06);
    gain.gain.exponentialRampToValueAtTime(0.001, ahora + i * 0.06 + 0.075);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ahora + i * 0.06);
    osc.stop(ahora + i * 0.06 + 0.08);
  });
}

// Queja graciosa si le dan demasiados clics seguidos
export function sonidoEnojo() {
  if (!sonidoHabilitado()) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const ahora = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(320, ahora);
  osc.frequency.exponentialRampToValueAtTime(150, ahora + 0.28);
  gain.gain.setValueAtTime(0.15, ahora);
  gain.gain.exponentialRampToValueAtTime(0.001, ahora + 0.28);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ahora);
  osc.stop(ahora + 0.29);
}

// Suspiro reconfortante cuando Tomi se calma
export function sonidoCalma() {
  if (!sonidoHabilitado()) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const ahora = ctx.currentTime;
  [440, 554.37].forEach(f => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f, ahora);
    gain.gain.setValueAtTime(0.09, ahora);
    gain.gain.exponentialRampToValueAtTime(0.001, ahora + 0.32);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ahora);
    osc.stop(ahora + 0.33);
  });
}

// Voz mediante Web Speech API (SpeechSynthesis)
export function decirConVoz(texto) {
  if (!sonidoHabilitado()) return;
  if (!('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(texto);
    const voces = window.speechSynthesis.getVoices?.() || [];
    // Priorizamos voces en español
    const vozEs = voces.find(v => v.lang && v.lang.toLowerCase().startsWith('es'));
    if (vozEs) u.voice = vozEs;
    u.lang = vozEs?.lang || 'es-ES';
    // Tono tierno y alegre para la mascota
    u.pitch = 1.3;
    u.rate = 1.05;
    u.volume = 1.0;
    window.speechSynthesis.speak(u);
  } catch (err) {
    console.debug('Error en síntesis de voz:', err);
  }
}

// Saluda con sonido y voz al entrar según el nombre del usuario
// Voz del tutorial: tiene su propio botón de audio, por eso no depende de sonidoHabilitado().
export function leerEnVoz(texto) {
  if (!('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(texto);
    const voces = window.speechSynthesis.getVoices?.() || [];
    const vozEs = voces.find(v => v.lang && v.lang.toLowerCase().startsWith('es'));
    if (vozEs) u.voice = vozEs;
    u.lang = vozEs?.lang || 'es-ES';
    u.pitch = 1.3;
    u.rate = 1.05;
    window.speechSynthesis.speak(u);
  } catch (err) {
    console.debug('Error en síntesis de voz:', err);
  }
}

export function callarVoz() {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

export function saludarAlEntrar(nombreCompleto) {
  const primerNombre = nombreCompleto ? nombreCompleto.trim().split(/\s+/)[0] : '';
  const saludoTexto = primerNombre ? `¡Hola, ${primerNombre}!` : '¡Hola!';

  sonidoSaludo();
  setTimeout(() => {
    decirConVoz(saludoTexto);
  }, 280);
}
