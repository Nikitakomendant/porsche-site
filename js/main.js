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
   THEME — light / dark toggle, persisted, drives both CSS vars and
   the three.js scene (background / fog / lights need real JS updates,
   CSS variables alone only reach DOM elements).
=================================================================== */
const THEME_KEY = 'porsche-site-theme';
const root = document.documentElement;
const themeToggle = document.getElementById('themeToggle');

function getStoredTheme() {
  try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; }
}
function setStoredTheme(v) {
  try { localStorage.setItem(THEME_KEY, v); } catch (e) { /* ignore */ }
}

let currentTheme = getStoredTheme() || 'dark';
root.setAttribute('data-theme', currentTheme);
if (themeToggle) themeToggle.setAttribute('aria-pressed', String(currentTheme === 'light'));

const THEME_SCENE = {
  dark: {
    bg: 0x0a0a0b,
    fogNear: 8, fogFar: 26,
    hemiSky: 0xbfd4ff, hemiGround: 0x0a0a0b, hemiIntensity: 0.55,
    keyIntensity: 2.4,
    rimColor: 0xffb37a, rimIntensity: 0.6,
    fillColor: 0x8fa8ff, fillIntensity: 0.5,
    shadowOpacity: 0.55,
    exposure: 1.05,
  },
  light: {
    bg: 0xf4f1ea,
    fogNear: 10, fogFar: 30,
    hemiSky: 0xffffff, hemiGround: 0xd8d3c6, hemiIntensity: 0.9,
    keyIntensity: 2.7,
    rimColor: 0xffcfa3, rimIntensity: 0.4,
    fillColor: 0xaebedd, fillIntensity: 0.35,
    shadowOpacity: 0.25,
    exposure: 1.15,
  },
};

/* ===================================================================
   1. RENDERER / SCENE / CAMERA
=================================================================== */
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 1.6, 6);

// Studio-style environment lighting (procedural, no external HDRI needed)
const pmrem = new THREE.PMREMGenerator(renderer);
const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environment = envTex;

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

// Warm accent rim instead of a strong saturated color, so it lifts the
// silhouette without tinting the paint's actual (beige) color.
const rim = new THREE.DirectionalLight(0xffb37a, 0.6);
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

function applySceneTheme(name) {
  const t = THEME_SCENE[name] || THEME_SCENE.dark;
  scene.background = new THREE.Color(t.bg);
  scene.fog = new THREE.Fog(t.bg, t.fogNear, t.fogFar);
  hemi.color.setHex(t.hemiSky);
  hemi.groundColor.setHex(t.hemiGround);
  hemi.intensity = t.hemiIntensity;
  key.intensity = t.keyIntensity;
  rim.color.setHex(t.rimColor);
  rim.intensity = t.rimIntensity;
  fill.color.setHex(t.fillColor);
  fill.intensity = t.fillIntensity;
  groundMat.opacity = t.shadowOpacity;
  renderer.toneMappingExposure = t.exposure;
}
applySceneTheme(currentTheme);

function setTheme(name) {
  currentTheme = name;
  root.setAttribute('data-theme', name);
  setStoredTheme(name);
  applySceneTheme(name);
  if (themeToggle) themeToggle.setAttribute('aria-pressed', String(name === 'light'));
}

themeToggle?.addEventListener('click', () => {
  setTheme(currentTheme === 'light' ? 'dark' : 'light');
});

// Respect system preference on first-ever visit (no stored choice yet)
if (!getStoredTheme() && window.matchMedia('(prefers-color-scheme: light)').matches) {
  setTheme('light');
}

/* ===================================================================
   2. MATERIALS
   This model was exported with real per-material PBR textures already
   baked in (baseColor / normal / metallic-roughness / occlusion /
   emissive) from the source USD scene, so GLTFLoader builds correct
   THREE.MeshStandardMaterial instances on its own — no keyword-guessing
   needed. We only patch two small things after load: aoMap needs a
   UV2 channel in three.js, and a couple of helper/collision meshes
   should stay hidden.
=================================================================== */
const HIDDEN_MATERIALS = new Set(['invisible_all']);

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
  const pct = total ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
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

    // Shadows + small per-material fixups (materials themselves are
    // already correct, baked into the GLB from the source USD scene)
    carRoot.traverse((child) => {
      if (!child.isMesh) return;
      child.castShadow = true;
      child.receiveShadow = true;

      // aoMap needs a second UV channel in three.js — reuse UV0
      if (child.geometry && child.geometry.attributes.uv && !child.geometry.attributes.uv2) {
        child.geometry.setAttribute('uv2', child.geometry.attributes.uv);
      }

      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach((m) => {
        if (m && HIDDEN_MATERIALS.has(m.name)) child.visible = false;
      });
    });

    // Auto-fit: center model, sit on ground, scale to a friendly size
    const box = new THREE.Box3().setFromObject(carRoot);
    const size = new THREE.Vector3(); box.getSize(size);
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

    buildCameraPath(modelRadius);
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
   4. CAMERA PATH — smooth Catmull-Rom spline through 4 chapter shots,
   instead of a piecewise-linear lerp. Linear interpolation between
   keyframes has a sharp velocity change at every waypoint, which reads
   as a "jump" mid-scroll; a spline keeps the camera moving on one
   continuous, easing curve for the whole scroll range.
=================================================================== */
function keyframes(r) {
  return [
    { pos: [0.15 * r, 0.55 * r, 2.1 * r], look: [0, 0.55 * r, 0] },          // 0 badge / front
    { pos: [2.4 * r, 0.5 * r, 0.9 * r], look: [0, 0.45 * r, 0] },           // 1 side profile
    { pos: [1.1 * r, 0.25 * r, -1.6 * r], look: [0.6 * r, 0.2 * r, -0.4 * r] }, // 2 rear wheel detail
    { pos: [-0.05 * r, 0.9 * r, 0.05 * r], look: [0, 0.65 * r, -0.3 * r] },  // 3 interior-ish top-down
  ];
}

let posCurve = null;
let lookCurve = null;

function buildCameraPath(r) {
  const kf = keyframes(r);
  const posPoints = kf.map(k => new THREE.Vector3(...k.pos));
  const lookPoints = kf.map(k => new THREE.Vector3(...k.look));
  // Duplicate first/last points so the curve doesn't overshoot at the ends
  // (chordal Catmull-Rom + edge padding keeps easing gentle at the very
  // start/end of the scroll range instead of overshooting off-path).
  posCurve = new THREE.CatmullRomCurve3(
    [posPoints[0], ...posPoints, posPoints[posPoints.length - 1]],
    false, 'catmullrom', 0.5
  );
  lookCurve = new THREE.CatmullRomCurve3(
    [lookPoints[0], ...lookPoints, lookPoints[lookPoints.length - 1]],
    false, 'catmullrom', 0.5
  );
}
buildCameraPath(modelRadius);

const tmpPos = new THREE.Vector3();
const tmpLook = new THREE.Vector3();
let scrollProgress = 0; // 0..1 across the whole pinned hero

function applyCamera(progress) {
  // Map 0..1 progress into the padded curve's 0..1 parameter range
  // (curve has 1 extra padding point on each end).
  const tMin = 1 / 6;
  const tMax = 1 - tMin;
  const t = THREE.MathUtils.lerp(tMin, tMax, Math.min(progress, 1));

  posCurve.getPointAt(t, tmpPos);
  lookCurve.getPointAt(t, tmpLook);
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
