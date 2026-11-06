import * as THREE from 'three';
import { sonidoPop, sonidoCosquillas, sonidoEnojo, sonidoCalma } from './tomi-audio.js';

// Tomi en 3D (diseño del equipo). Cada instancia es una escena cuyo lienzo se mueve
// entre pantallas, porque la app redibuja el HTML seguido: 'logo' vive en la barra
// lateral y 'vista' pasa por la carga, el login, el inicio, la caja y las alertas.

const FRASES_ALEGRES = [
  '¡Hola! 🍅✨ ¡Qué alegría verte!',
  '¡Me haces cosquillas! 😄',
  '¡El inventario está en las mejores manos!',
  '¡Soy Tomi, tu tomate favorito! 🍅❤️',
  '¡Fresco, crujiente y organizado!',
  '¡Vamos a tener una jornada súper productiva! 🚀',
];
const FRASES_ENOJO = [
  '¡Ey! ¡Eso duele!',
  '¡No me aprietes tan rápido, que me hago puré!',
  '¡Grrr! Cuidado con ese dedo.',
  '¡Me vas a convertir en salsa!',
  '¡Ya basta! Estoy más rojo que de costumbre.',
];
const FRASES_CALMA = ['Bueno… te perdono 🍅', 'Uf, ya pasó. ¿Seguimos?', 'Está bien, ¡pero con cariño! ❤️'];
const HABLA_CADA_MS = 7000;
const ENOJO_MS = 2400;
const elegir = a => a[Math.floor(Math.random() * a.length)];

const instancias = new Map();

export function tomi3D(clave = 'vista') {
  if (!instancias.has(clave)) instancias.set(clave, crear());
  return instancias.get(clave);
}

function crear() {
  const el = document.createElement('div');
  el.className = 'tomi3d';
  const canvas = document.createElement('canvas');
  const globo = document.createElement('div');
  globo.className = 'tomi3d-globo';
  globo.setAttribute('role', 'status');
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Tomi, la mascota de FrescoStock');
  el.append(canvas, globo);

  const BASE = { frases: [], globo: false, alHablar: null, estado: 'feliz' };
  let opciones = { ...BASE };

  // ---------- Escena ----------
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x887766, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 0.9); key.position.set(3, 5, 6); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffd6c0, 0.35); rim.position.set(-5, 2, -3); scene.add(rim);

  const R = 1.5, CY = 0.2, SY = 0.95;
  const surf = (x, y) => Math.sqrt(Math.max(0.01, R * R - x * x - Math.pow((y - CY) / SY, 2)));

  const matBody = new THREE.MeshPhysicalMaterial({ color: 0xe22c17, roughness: 0.28, clearcoat: 0.85, clearcoatRoughness: 0.18, emissive: 0x000000 });
  const matGreen = new THREE.MeshStandardMaterial({ color: 0x4fa23a, roughness: 0.55 });
  const matStem = new THREE.MeshStandardMaterial({ color: 0x7a5a2e, roughness: 0.8 });
  const matDark = new THREE.MeshStandardMaterial({ color: 0x1c0d0a, roughness: 0.25 });
  const matWhite = new THREE.MeshBasicMaterial({ color: 0xffffff });

  const tomi = new THREE.Group(); scene.add(tomi);

  // Cuerpo y patitas
  const body = new THREE.Mesh(new THREE.SphereGeometry(R, 64, 48), matBody);
  body.scale.set(1, SY, 1); body.position.y = CY; tomi.add(body);
  [-0.62, 0.62].forEach(x => {
    const leg = new THREE.Mesh(new THREE.SphereGeometry(0.34, 32, 24), matBody);
    leg.scale.set(1, 1.15, 1); leg.position.set(x, -1.28, 0.1); tomi.add(leg);
  });

  // Tallo y hojas
  const crown = new THREE.Group(); crown.position.y = CY + R * SY - 0.05; tomi.add(crown);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 0.55, 12), matStem);
  stem.position.y = 0.3; stem.rotation.z = -0.15; crown.add(stem);
  for (let i = 0; i < 5; i++) {
    const pivot = new THREE.Group(); pivot.rotation.y = i * (Math.PI * 2 / 5) + 0.3;
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 12), matGreen);
    leaf.scale.set(1.15, 0.07, 0.3); leaf.position.set(0.5, 0.08 + (i % 2) * 0.05, 0); leaf.rotation.z = 0.28;
    pivot.add(leaf); crown.add(pivot);
  }

  // Bracitos (pivotan desde el hombro): saludan al llegar y se alzan al celebrar
  const arms = [-1, 1].map(side => {
    const pivot = new THREE.Group(); pivot.position.set(side * 1.42, -0.1, 0.1); tomi.add(pivot);
    const arm = new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 14), matBody);
    arm.scale.set(1, 1.7, 1); arm.position.set(side * 0.12, -0.3, 0); pivot.add(arm);
    return { pivot, side };
  });

  // Cara: grupo que pivota desde el centro del cuerpo para "mirar"
  const face = new THREE.Group(); face.position.y = CY; tomi.add(face);
  const place = (obj, x, y, off = 0) => {
    obj.position.set(x, y - CY, surf(x, y) + off);
    obj.rotation.y = Math.asin(Math.min(1, x / R));
    obj.rotation.x = -(y - CY) / R * 0.9;
    face.add(obj);
    return obj;
  };

  const eyes = [-0.5, 0.5].map(x => {
    const g = new THREE.Group();
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.27, 32, 24), matDark); ball.scale.z = 0.55; g.add(ball);
    const h1 = new THREE.Mesh(new THREE.SphereGeometry(0.085, 14, 12), matWhite); h1.position.set(0.09, 0.09, 0.14); g.add(h1);
    const h2 = new THREE.Mesh(new THREE.SphereGeometry(0.038, 10, 8), matWhite); h2.position.set(-0.08, -0.09, 0.14); g.add(h2);
    const h3 = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 8), matWhite); h3.position.set(0.03, -0.08, 0.14); g.add(h3);
    return place(g, x, 0.35, -0.02);
  });

  const cheeks = [-0.98, 0.98].map(x => {
    const m = new THREE.MeshStandardMaterial({ color: 0xf29bb0, roughness: 0.5 });
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.26, 24, 16), m);
    c.scale.set(1.15, 0.7, 0.3); c.rotation.z = x < 0 ? 0.15 : -0.15;
    const g = new THREE.Group(); g.add(c); place(g, x, -0.12, -0.02);
    return m;
  });

  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.035, 12, 32, Math.PI), matDark);
  mouth.position.set(0, -0.2 - CY, surf(0, -0.4) + 0.01); mouth.rotation.z = Math.PI; face.add(mouth);

  const brows = [[-0.5, -0.5], [0.5, 0.5]].map(([x, rz]) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.07), matDark);
    b.position.set(x, 0.82 - CY, surf(x, 0.82) + 0.04);
    b.rotation.set(-0.3, 0, rz); b.scale.set(0.001, 0.001, 0.001);
    face.add(b);
    return b;
  });

  // Sombra suave
  const sc = document.createElement('canvas'); sc.width = sc.height = 128;
  const sx = sc.getContext('2d'), gr = sx.createRadialGradient(64, 64, 4, 64, 64, 62);
  gr.addColorStop(0, 'rgba(0,0,0,.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  sx.fillStyle = gr; sx.fillRect(0, 0, 128, 128);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = -1.6; scene.add(shadow);

  // ---------- Tamaño ----------
  function resize() {
    const w = el.clientWidth, h = el.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Con globo se deja espacio holgado arriba para el texto; sin globo Tomi ocupa todo el alto.
    const espacio = opciones.globo ? 8.8 : 6.6;
    camera.position.set(0, opciones.globo ? 0.35 : 0.5, espacio * Math.max(1, 0.7 / camera.aspect));
    camera.lookAt(0, opciones.globo ? 0.45 : -0.05, 0);
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(el);

  // ---------- Puntero ----------
  const mouse = { x: 0, y: 0 }, look = { x: 0, y: 0 };
  window.addEventListener('pointermove', e => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
  });
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function tocaTomi(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.intersectObject(tomi, true).length > 0;
  }
  let clicsRapidos = 0, ultimoClic = 0;
  canvas.addEventListener('pointermove', e => { canvas.style.cursor = tocaTomi(e) ? 'pointer' : 'default'; });
  canvas.addEventListener('pointerdown', e => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1; mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
    if (tocaTomi(e)) {
      const ahora = performance.now();
      if (ahora - ultimoClic < 1500) {
        clicsRapidos++;
      } else {
        clicsRapidos = 1;
      }
      ultimoClic = ahora;

      if (clicsRapidos >= 3) {
        enojarse();
      } else {
        alegrarse();
      }
    }
  });

  // ---------- Habla ----------
  let ocultarT = null, enojoT = null, ultimaVez = 0;
  function decir(texto, ms = 4200, enojado = false, conSonido = true) {
    ultimaVez = performance.now();
    if (!enojado && conSonido) sonidoPop();
    if (!opciones.globo) {
      globo.classList.remove('show');
      opciones.alHablar?.(texto, enojado);
      return;
    }
    globo.textContent = texto;
    globo.className = 'tomi3d-globo show' + (enojado ? ' enojado' : '');
    clearTimeout(ocultarT);
    ocultarT = setTimeout(() => globo.classList.remove('show'), ms);
  }
  let enojado = false, objetivo = 0;
  function alegrarse() {
    saludoDesde = clock.getElapsedTime();
    sonidoCosquillas();
    const repertorio = opciones.frases?.length
      ? [...opciones.frases, ...FRASES_ALEGRES]
      : FRASES_ALEGRES;
    decir(elegir(repertorio), 3500, false, false);
  }
  function enojarse() {
    enojado = true; objetivo = 1;
    sonidoEnojo();
    decir(elegir(FRASES_ENOJO), ENOJO_MS + 300, true, false);
    clearTimeout(enojoT);
    enojoT = setTimeout(() => {
      enojado = false; objetivo = 0;
      sonidoCalma();
      decir(elegir(FRASES_CALMA), 3000, false, false);
    }, ENOJO_MS);
  }
  // Los mensajes NO se repiten automáticamente en bucle continuo para evitar sonidos consecutivos tediosos.
  // Tomi habla cuando el usuario entra (saludo personalizado) o al interactuar/hacer clic sobre él.

  // ---------- Animación ----------
  // anger: clic; worry y party vienen del estado ('preocupado' o 'celebrando').
  let anger = 0, worry = 0, party = 0, blink = 0, nextBlink = 2;
  const clock = new THREE.Clock();
  const cNormal = new THREE.Color(0xe0301c), cAngry = new THREE.Color(0xff1f0a);
  const pNormal = new THREE.Color(0xf29bb0), pAngry = new THREE.Color(0xff4a3a);
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const v = new THREE.Vector3();

  // Solo se dibuja si el lienzo es visible y la pestaña está activa (ahorra CPU/GPU).
  let visible = true;
  if ('IntersectionObserver' in window) new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(el);
  let saludoDesde = -10; // instante de la última llegada: dispara el saludo con la manita

  function tick() {
    requestAnimationFrame(tick);
    if (!el.isConnected || !visible || document.hidden) return; // fuera de pantalla no se dibuja
    const t = clock.getElapsedTime();
    anger += (objetivo - anger) * 0.12;
    worry += ((opciones.estado === 'preocupado' ? 1 : 0) - worry) * 0.08;
    party += ((opciones.estado === 'celebrando' ? 1 : 0) - party) * 0.08;

    const mv = reduce ? 0 : 1; // con movimiento reducido no sigue el cursor ni se balancea
    look.x += (mouse.x * mv - look.x) * 0.1; look.y += (mouse.y * mv - look.y) * 0.1;
    face.rotation.y = look.x * 0.5; face.rotation.x = look.y * 0.32 + worry * 0.12;
    tomi.rotation.y = look.x * 0.22; tomi.rotation.x = look.y * 0.08;

    const bob = reduce ? 0 : Math.sin(t * 2) * 0.05 + party * Math.abs(Math.sin(t * 5)) * 0.28;
    const shake = anger > 0.5 && !reduce ? Math.sin(t * 55) * 0.05 * anger : 0;
    tomi.position.set(shake, bob, 0);
    // Respiración con squash & stretch suave
    const puff = 1 + anger * 0.06 + (reduce ? 0 : Math.sin(t * 2) * 0.012);
    tomi.scale.set(puff, 1 / puff * (1 + anger * 0.03), puff);
    tomi.rotation.z = reduce ? 0 : Math.sin(t * 0.9) * 0.025 * (1 - party) + party * Math.sin(t * 5) * 0.05; // balanceo
    crown.rotation.z = shake * 2 + (reduce ? 0 : Math.sin(t * 1.3) * 0.03);

    // Brazos: reposo con balanceo, saludo al llegar, arriba al celebrar, pegados si preocupa
    const saludo = reduce ? 0 : Math.max(0, 1 - (t - saludoDesde) / 2.2);
    arms.forEach(({ pivot, side }) => {
      const reposo = side * (0.35 + Math.sin(t * 2 + side) * 0.04 * mv);
      const arriba = side * (-2.5 + Math.sin(t * 9) * 0.25 * mv);
      let z = reposo + (arriba - reposo) * party;
      if (side > 0) z += (-2.3 + Math.sin(t * 11) * 0.35 - z) * saludo;
      z += side * worry * 0.25;
      pivot.rotation.z += (z - pivot.rotation.z) * 0.15;
    });

    matBody.color.copy(cNormal).lerp(cAngry, anger);
    matBody.emissive.setRGB(0.35 * anger * (0.6 + 0.4 * Math.sin(t * 14)), 0, 0);
    cheeks.forEach(m => m.color.copy(pNormal).lerp(pAngry, anger));

    // Parpadeo
    if (t > nextBlink) { blink = 1; nextBlink = t + 2 + Math.random() * 3; }
    blink = Math.max(0, blink - 0.12);
    const bl = 1 - Math.sin(blink * Math.PI) * 0.9;
    eyes.forEach(e => { e.scale.y = bl * (1 - anger * 0.25); });

    // Boca: de sonrisa a ceño (enojado del todo, preocupado a medias)
    const ceno = Math.max(anger, worry * 0.85);
    mouth.rotation.z = Math.PI * (1 - ceno);
    mouth.position.y = (-0.2 + (-0.5 + 0.2) * ceno) - CY;
    mouth.scale.set(1 - ceno * 0.1 - worry * 0.25, 1, 1);

    // Cejas: enojado baja la punta interior; preocupado la sube
    const bs = Math.max(0.001, anger, worry * 0.8);
    const lado = anger >= worry ? 1 : -0.7;
    brows.forEach((b, i) => { b.scale.set(bs, bs, bs); b.rotation.z = (i ? 0.5 : -0.5) * lado; });

    // Globo sobre la cabeza (ubicado siempre arriba de la coronita para no tapar a Tomi)
    if (opciones.globo) {
      v.set(0, 2.22, 0); tomi.localToWorld(v); v.project(camera);
      let px = (v.x * 0.5 + 0.5) * el.clientWidth;
      const py = (-v.y * 0.5 + 0.5) * el.clientHeight;
      const half = globo.offsetWidth / 2;
      if (el.clientWidth > globo.offsetWidth + 20) {
        px = Math.min(Math.max(px, half + 10), el.clientWidth - half - 10);
      }
      globo.style.left = px + 'px';
      // Con transform: translate(-50%, -100%), la base del globo queda en top.
      // py - 12 sitúa la flechita 12px arriba de la coronita de Tomi.
      // El cuerpo del globo crece hacia ARRIBA, evitando por completo tapar la carita y cuerpo.
      globo.style.top = (py - 12) + 'px';
    }

    renderer.render(scene, camera);
  }
  tick();

  return {
    el,
    // Mueve a Tomi dentro de `slot`. frases: lo que dice solo; globo: false para que hable por alHablar;
    // estado: 'feliz', 'preocupado' o 'celebrando'.
    colocar(slot, nuevas = {}) {
      const cambio = opciones.frases !== nuevas.frases;
      opciones = { ...BASE, ...nuevas };
      el.classList.toggle('sin-globo', !opciones.globo);
      if (el.parentNode !== slot) {
        slot.append(el);
        // Entrada suave (opacidad/transform) y saludo con la manita en cada llegada
        el.classList.remove('entra'); void el.offsetWidth; el.classList.add('entra');
        saludoDesde = clock.getElapsedTime();
      }
      resize();
      if (cambio && opciones.globo && opciones.frases.length) {
        globo.classList.remove('show');
        setTimeout(() => { if (!enojado) decir(opciones.frases[0], 5000, false, false); }, 500);
      }
    },
    decir: (texto, ms) => decir(texto, ms, false),
    enojarse,
  };
}
