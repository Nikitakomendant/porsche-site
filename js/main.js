import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/* ===================================================================
   0. GLOBAL HELPERS
=================================================================== */
const isMobile = window.matchMedia('(max-width: 780px)').matches;
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
gsap.registerPlugin(ScrollTrigger);

/* ===================================================================
   1. RENDERER / SCENE / CAMERA
=================================================================== */
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a0b);
scene.fog = new THREE.Fog(0x0a0a0b, 8, 26);

const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 1.6, 6);

// Studio-style environment lighting (procedural, no external HDRI needed)
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const hemi = new THREE.HemisphereLight(0xbfd4ff, 0x0a0a0b, 0.55);
scene.add(hemi);

const key = new THREE.DirectionalLight(0xffffff, 2.4);
key.position.set(5, 6, 4);
key.castShadow = true;
key.shadow.mapSize.set(isMobile ? 1024 : 2048, isMobile ? 1024 : 2048);
key.shadow.camera.near = 1;
key.shadow.camera.far = 20;
key.shadow.camera.left = -6; key.shadow.camera.right = 6;
key.shadow.camera.top = 6; key.shadow.camera.bottom = -6;
key.shadow.bias = -0.0006;
scene.add(key);

const rim = new THREE.DirectionalLight(0xff3b4d, 1.1);
rim.position.set(-6, 3, -5);
scene.add(rim);

const fill = new THREE.DirectionalLight(0x8fa8ff, 0.5);
fill.position.set(-3, 2, 5);
scene.add(fill);

// Ground / contact shadow
const groundGeo = new THREE.CircleGeometry(9, 64);
const groundMat = new THREE.ShadowMaterial({ opacity: 0.55 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

/* ===================================================================
   2. TEXTURE ENGINE — smart keyword-based material assignment
   The source pack ships raw meshes + a loose folder of texture maps
   (no baked-in linking), so materials are matched to textures here by
   name. Edit BUCKETS below to fine-tune a specific part if needed —
   open devtools console to see the real material names logged.
=================================================================== */
const TEX_PATH = 'assets/textures/';
const texLoader = new THREE.TextureLoader();
const texCache = {};
function tex(file, { srgb = false } = {}) {
  if (!file) return null;
  if (!texCache[file]) {
    const t = texLoader.load(TEX_PATH + file);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    texCache[file] = t;
  }
  return texCache[file];
}

// order matters: first matching test wins. `all`: every keyword must be present.
const BUCKETS = [
  { all: ['perfo'],                color: 'leather_Color.jpeg', ao: 'AO_leather_perforated_1024.jpeg', rough: 'Leather_perfo_roughness.jpeg', normal: 'Leather_perfo_normal.jpeg', roughness: 0.65, metalness: 0.0 },
  { all: ['leather'],              color: 'leather_Color.jpeg', ao: 'AO_leather_int_1024.jpeg', rough: 'leather_roughness.jpeg', normal: 'leather_normal.jpeg', roughness: 0.6, metalness: 0.0 },
  { all: ['uphol'],                color: 'upholstery_color.jpeg', ao: 'AO_upholstery_1024.jpeg', normal: 'upholstery_NM.jpeg', roughness: 0.85, metalness: 0.0 },
  { all: ['rug'],                  color: 'rug_color.jpeg', ao: 'AO_rug_interior_1024.jpeg', normal: 'rug_NM.jpeg', roughness: 0.95, metalness: 0.0 },
  { all: ['belt'],                 ao: 'AO_belts_1024.jpeg', normal: 'belts_normal.jpeg', rough: 'belts_roughness.jpeg', color: 0x1a1a1a, roughness: 0.7, metalness: 0.0 },
  { all: ['tire'],                 ao: 'AO_tires_1024.jpeg', normal: 'tire_NM_all.jpeg', color: 0x121212, roughness: 0.95, metalness: 0.0 },
  { all: ['disc'],                 color: 'Discs_color.jpeg', rough: 'Discs_rough.jpeg', roughness: 0.5, metalness: 0.9 },
  { all: ['brake'],                ao: 'AO_brakes_1024.jpeg', color: 0xb43038, roughness: 0.45, metalness: 0.6 },
  { all: ['rim', 'chrom'],         ao: 'AO_rim_chrome_1024.jpeg', color: 0xe9e9ea, roughness: 0.12, metalness: 1.0 },
  { all: ['rim'],                  ao: 'AO_rim_black_1024.jpeg', color: 0x111214, roughness: 0.3, metalness: 0.9 },
  { all: ['pipe'],                 ao: 'AO_pipes_chrom_1024.jpeg', color: 0xdfdfe1, roughness: 0.12, metalness: 1.0 },
  { all: ['chrom'],                ao: 'AO_pipes_chrom_1024.jpeg', color: 0xdfdfe1, roughness: 0.1, metalness: 1.0 },
  { all: ['carbon'],               color: 'Carbon_color.jpeg', rough: 'Carbon_roughness.jpeg', roughness: 0.4, metalness: 0.3 },
  { all: ['logo'],                 ao: 'AO_LOGO1_1024.jpeg', normal: 'logo_NM.jpeg', color: 0xd7d7d9, roughness: 0.25, metalness: 0.95 },
  { all: ['plate'],                color: 'number_plate_logo.jpeg', roughness: 0.5, metalness: 0.1 },
  { all: ['reflect'],              color: 'reflectors_color.jpeg', normal: 'reflectors_NM.jpeg', roughness: 0.2, metalness: 0.4, emissive: 0x552200, emissiveIntensity: 0.25 },
  { all: ['headlight'],            normal: 'headlights_pattern_NM.jpeg', color: 0xf5f5f5, roughness: 0.05, metalness: 0.0, transparent: true, opacity: 0.9, emissive: 0xffffff, emissiveIntensity: 0.08 },
  { all: ['light'],                color: 'emission_all_lights.jpeg', emissive: 0xffffff, emissiveIntensity: 0.6, roughness: 0.3, metalness: 0.0 },
  { all: ['glass'],                color: 0x0b0d10, roughness: 0.02, metalness: 0.1, transparent: true, opacity: 0.35 },
  { all: ['window'],               color: 0x0b0d10, roughness: 0.02, metalness: 0.1, transparent: true, opacity: 0.35 },
  { all: ['plast'],                ao: 'AO_bl_pl_M_ext_1024.jpeg', color: 0x0d0d0e, roughness: 0.55, metalness: 0.05 },
  { all: ['invis'],                color: 0x0a0a0a, roughness: 0.8, metalness: 0.0, visible: false },
  { all: ['ground'],               color: 'internal_ground_ao_texture.jpeg', roughness: 1.0, metalness: 0.0 },
  { all: ['body'],                 ao: 'AO_body_main_1024.jpeg', color: 0x3d4046, roughness: 0.3, metalness: 0.85, clearcoat: 1.0, clearcoatRoughness: 0.04 },
];
const DEFAULT_BUCKET = { color: 0x2c2e32, roughness: 0.5, metalness: 0.4 };

function resolveBucket(name) {
  const n = (name || '').toLowerCase();
  return BUCKETS.find(b => b.all.every(k => n.includes(k))) || DEFAULT_BUCKET;
}

function buildMaterial(sourceMat, meshName) {
  const b = resolveBucket((sourceMat && sourceMat.name) || meshName);
  const params = {
    roughness: b.roughness ?? 0.5,
    metalness: b.metalness ?? 0.3,
    clearcoat: b.clearcoat ?? 0,
    clearcoatRoughness: b.clearcoatRoughness ?? 0,
    transparent: !!b.transparent,
    opacity: b.opacity ?? 1,
  };
  if (typeof b.color === 'string') params.map = tex(b.color, { srgb: true });
  else if (typeof b.color === 'number') params.color = new THREE.Color(b.color);
  if (b.ao) params.aoMap = tex(b.ao);
  if (b.rough) params.roughnessMap = tex(b.rough);
  if (b.normal) params.normalMap = tex(b.normal);
  if (b.emissive) { params.emissive = new THREE.Color(b.emissive); params.emissiveIntensity = b.emissiveIntensity ?? 1; }

  const mat = new THREE.MeshPhysicalMaterial(params);
  mat.visible = b.visible !== false;
  return mat;
}

/* ===================================================================
   3. LOAD MODEL
=================================================================== */
const loaderEl = document.getElementById('loader');
const loaderBar = document.getElementById('loaderBar');
const loaderPct = document.getElementById('loaderPct');

function showLoaderTrouble(message) {
  loaderBar.style.width = '0%';
  loaderBar.style.background = '#ff3b4d';
  loaderPct.parentElement.innerHTML = message;
}

// Opening index.html by double-click (file://) blocks the model from loading
// in every browser — catch this immediately with a clear explanation instead
// of leaving the loader stuck at 0%.
if (location.protocol === 'file:') {
  showLoaderTrouble(
    'Сайт відкрито напряму з файлів — браузер блокує завантаження 3D-моделі в цьому режимі.<br><br>' +
    'Найпростіше: перетягніть цю папку на <a href="https://app.netlify.com/drop" target="_blank" rel="noopener" style="color:#ff5c6e;text-decoration:underline;">app.netlify.com/drop</a> — отримаєте робоче посилання за секунди.<br><br>' +
    'Або локально: <code>npx serve .</code> у терміналі в цій папці, потім відкрити адресу, яку він покаже.'
  );
}

// Safety net: if nothing has finished loading after a while, something is
// stuck (wrong path, blocked request, slow connection) — say so on screen.
const stallTimer = setTimeout(() => {
  if (!loaderEl.classList.contains('is-hidden') && location.protocol !== 'file:') {
    showLoaderTrouble(
      'Завантаження триває занадто довго.<br><br>' +
      'Перевірте, що сайт відкрито через сервер (не подвійним кліком по файлу), ' +
      'що папка <code>assets/models/</code> зі сцени не була випадково пропущена при заливці, ' +
      'та подивіться вкладку Console (F12) — там буде точний текст помилки.'
    );
  }
}, 15000);

const manager = new THREE.LoadingManager();
manager.onProgress = (url, loaded, total) => {
  const pct = Math.min(100, Math.round((loaded / total) * 100));
  loaderBar.style.width = pct + '%';
  loaderPct.textContent = pct;
};

let carRoot = null;
let modelRadius = 3;

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://unpkg.com/three@0.160.0/examples/jsm/libs/draco/');
const gltfLoader = new GLTFLoader(manager);
gltfLoader.setDRACOLoader(dracoLoader);
gltfLoader.load(
  'assets/models/porsche_911_turbo.glb',
  (gltf) => {
    carRoot = gltf.scene;

    // Normalize materials + shadows, log names for easy fine-tuning
    const seen = new Set();
    carRoot.traverse((child) => {
      if (!child.isMesh) return;
      child.castShadow = true;
      child.receiveShadow = true;

      // aoMap needs a second UV channel in three.js — reuse UV0
      if (child.geometry && child.geometry.attributes.uv && !child.geometry.attributes.uv2) {
        child.geometry.setAttribute('uv2', child.geometry.attributes.uv);
      }

      const srcMats = Array.isArray(child.material) ? child.material : [child.material];
      const newMats = srcMats.map((m) => {
        if (m && !seen.has(m.name)) { seen.add(m.name); console.log('[material]', m.name || '(unnamed)'); }
        return buildMaterial(m, child.name);
      });
      child.material = Array.isArray(child.material) ? newMats : newMats[0];
    });

    // Auto-fit: center model, sit on ground, scale to a friendly size
    const box = new THREE.Box3().setFromObject(carRoot);
    const size = new THREE.Vector3(); box.getSize(size);
    const center = new THREE.Vector3(); box.getCenter(center);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = 4.2 / maxDim; // target ~4.2 world units long
    carRoot.scale.setScalar(scale);

    const box2 = new THREE.Box3().setFromObject(carRoot);
    const size2 = new THREE.Vector3(); box2.getSize(size2);
    const center2 = new THREE.Vector3(); box2.getCenter(center2);
    carRoot.position.x -= center2.x;
    carRoot.position.z -= center2.z;
    carRoot.position.y -= box2.min.y;

    modelRadius = size2.length() * 0.5;
    scene.add(carRoot);

    KF = keyframes(modelRadius);
    applyCamera(scrollProgress);

    finishLoading();
  },
  undefined,
  (err) => {
    clearTimeout(stallTimer);
    console.error('Failed to load GLB model:', err);
    showLoaderTrouble(
      'Не вдалося завантажити 3D-модель.<br><br>' +
      'Переконайтесь, що папка <code>assets/models/porsche_911_turbo.glb</code> завантажена разом із рештою сайту, ' +
      'і що сторінка відкрита не подвійним кліком по файлу, а через сервер/хостинг.'
    );
  }
);

function finishLoading() {
  clearTimeout(stallTimer);
  loaderEl.classList.add('is-hidden');
  ScrollTrigger.refresh();
}

/* ===================================================================
   4. CAMERA KEYFRAMES — 4 chapters, interpolated by scroll progress
   Positions expressed as multiples of modelRadius so it adapts to
   whatever scale the source FBX actually ships at.
=================================================================== */
function keyframes(r) {
  return [
    { pos: [0.15 * r, 0.55 * r, 2.1 * r], look: [0, 0.55 * r, 0] },   // 0 badge / front
    { pos: [2.4 * r, 0.5 * r, 0.9 * r],  look: [0, 0.45 * r, 0] },    // 1 side profile
    { pos: [1.1 * r, 0.25 * r, -1.6 * r], look: [0.6 * r, 0.2 * r, -0.4 * r] }, // 2 rear wheel detail
    { pos: [-0.05 * r, 0.9 * r, 0.05 * r], look: [0, 0.65 * r, -0.3 * r] },     // 3 interior-ish top-down
  ];
}

let KF = keyframes(modelRadius);
const tmpPos = new THREE.Vector3();
const tmpLook = new THREE.Vector3();
let scrollProgress = 0; // 0..1 across the whole pinned hero

function applyCamera(progress) {
  const segs = KF.length - 1;
  const scaled = Math.min(progress, 0.9999) * segs;
  const i = Math.floor(scaled);
  const t = scaled - i;
  const a = KF[i], b = KF[Math.min(i + 1, segs)];
  tmpPos.set(
    THREE.MathUtils.lerp(a.pos[0], b.pos[0], t),
    THREE.MathUtils.lerp(a.pos[1], b.pos[1], t),
    THREE.MathUtils.lerp(a.pos[2], b.pos[2], t)
  );
  tmpLook.set(
    THREE.MathUtils.lerp(a.look[0], b.look[0], t),
    THREE.MathUtils.lerp(a.look[1], b.look[1], t),
    THREE.MathUtils.lerp(a.look[2], b.look[2], t)
  );
  camera.position.copy(tmpPos);
  camera.lookAt(tmpLook);
}
applyCamera(0);

/* ===================================================================
   5. SCROLLTRIGGER — pin hero, scrub camera + chapter text
=================================================================== */
const chapterEls = gsap.utils.toArray('.chapter');
const scrollHint = document.getElementById('scrollHint');

function setActiveChapter(idx) {
  chapterEls.forEach((el, i) => el.classList.toggle('is-active', i === idx));
}
setActiveChapter(0);

if (!prefersReduced) {
  ScrollTrigger.create({
    trigger: '.hero',
    start: 'top top',
    end: 'bottom bottom',
    scrub: 0.6,
    onUpdate: (self) => {
      scrollProgress = self.progress;
      applyCamera(scrollProgress);
      const chapIdx = Math.min(chapterEls.length - 1, Math.floor(scrollProgress * chapterEls.length));
      setActiveChapter(chapIdx);
      scrollHint.classList.toggle('is-hidden', self.progress > 0.03);
    },
  });
} else {
  // Reduced motion: static, gentle chapter fade, no camera scrub
  setActiveChapter(0);
}

/* ===================================================================
   6. NAV — mobile menu + shrink on scroll
=================================================================== */
const burger = document.getElementById('burger');
const navMobile = document.getElementById('navMobile');
burger?.addEventListener('click', () => {
  navMobile.classList.toggle('is-open');
});
navMobile?.querySelectorAll('a').forEach(a => a.addEventListener('click', () => navMobile.classList.remove('is-open')));

document.getElementById('year').textContent = new Date().getFullYear();

/* ===================================================================
   7. RENDER LOOP
=================================================================== */
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();

  if (carRoot) {
    // subtle idle rotation, always on, adds life to the reveal
    carRoot.rotation.y += dt * 0.05;
  }

  renderer.render(scene, camera);
}
animate();

/* ===================================================================
   8. RESIZE
=================================================================== */
function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
}
window.addEventListener('resize', onResize);
