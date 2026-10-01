/* Galeria circular do portfolio (WebGL, via ogl). Adaptado do componente
   React "CircularGallery" (reactbits.dev) para JS puro, sem React nem build,
   para casar com o resto do site (HTML/CSS/JS estatico). */

import { Camera, Mesh, Plane, Program, Raycast, Renderer, Texture, Transform, Vec2 } from 'https://esm.sh/ogl@1.0.11';

function lerp(p1, p2, t) {
  return p1 + (p2 - p1) * t;
}

function autoBind(instance) {
  const proto = Object.getPrototypeOf(instance);
  Object.getOwnPropertyNames(proto).forEach((key) => {
    if (key !== 'constructor' && typeof instance[key] === 'function') {
      instance[key] = instance[key].bind(instance);
    }
  });
}

function getFontSize(font) {
  const match = font.match(/(\d+)px/);
  return match ? parseInt(match[1], 10) : 30;
}

function createTextTexture(gl, text, font = 'bold 30px monospace', color = 'black') {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  context.font = font;
  const metrics = context.measureText(text);
  const textWidth = Math.ceil(metrics.width);
  const textHeight = Math.ceil(getFontSize(font) * 1.2);
  canvas.width = textWidth + 20;
  canvas.height = textHeight + 20;
  context.font = font;
  context.fillStyle = color;
  context.textBaseline = 'middle';
  context.textAlign = 'center';
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture = new Texture(gl, { generateMipmaps: false });
  texture.image = canvas;
  return { texture, width: canvas.width, height: canvas.height };
}

class Title {
  constructor({ gl, plane, text, textColor = '#545050', font = '30px sans-serif' }) {
    this.gl = gl;
    this.plane = plane;
    this.text = text;
    this.textColor = textColor;
    this.font = font;
    this.createMesh();
  }
  createMesh() {
    const { texture, width, height } = createTextTexture(this.gl, this.text, this.font, this.textColor);
    const geometry = new Plane(this.gl);
    const program = new Program(this.gl, {
      vertex: `
        attribute vec3 position;
        attribute vec2 uv;
        uniform mat4 modelViewMatrix;
        uniform mat4 projectionMatrix;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragment: `
        precision highp float;
        uniform sampler2D tMap;
        varying vec2 vUv;
        void main() {
          vec4 color = texture2D(tMap, vUv);
          if (color.a < 0.1) discard;
          gl_FragColor = color;
        }
      `,
      uniforms: { tMap: { value: texture } },
      transparent: true
    });
    this.mesh = new Mesh(this.gl, { geometry, program });
    const aspect = width / height;
    const textHeight = this.plane.scale.y * 0.15;
    const textWidth = textHeight * aspect;
    this.mesh.scale.set(textWidth, textHeight, 1);
    this.mesh.position.y = -this.plane.scale.y * 0.5 - textHeight * 0.5 - 0.05;
    this.mesh.setParent(this.plane);
  }
}

class Media {
  constructor({ geometry, gl, image, index, length, scene, screen, text, viewport, bend, textColor, borderRadius = 0, font }) {
    this.extra = 0;
    this.geometry = geometry;
    this.gl = gl;
    this.image = image;
    this.index = index;
    this.length = length;
    this.scene = scene;
    this.screen = screen;
    this.text = text;
    this.viewport = viewport;
    this.bend = bend;
    this.textColor = textColor;
    this.borderRadius = borderRadius;
    this.font = font;
    this.createShader();
    this.createMesh();
    this.createTitle();
    this.onResize();
  }
  createShader() {
    const texture = new Texture(this.gl, { generateMipmaps: true });
    this.program = new Program(this.gl, {
      depthTest: false,
      depthWrite: false,
      vertex: `
        precision highp float;
        attribute vec3 position;
        attribute vec2 uv;
        uniform mat4 modelViewMatrix;
        uniform mat4 projectionMatrix;
        uniform float uTime;
        uniform float uSpeed;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec3 p = position;
          p.z = (sin(p.x * 4.0 + uTime) * 0.5 + cos(p.y * 2.0 + uTime) * 0.5) * (0.04 + uSpeed * 0.15);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragment: `
        precision highp float;
        uniform vec2 uImageSizes;
        uniform vec2 uPlaneSizes;
        uniform sampler2D tMap;
        uniform float uBorderRadius;
        varying vec2 vUv;

        float roundedBoxSDF(vec2 p, vec2 b, float r) {
          vec2 d = abs(p) - b;
          return length(max(d, vec2(0.0))) + min(max(d.x, d.y), 0.0) - r;
        }

        void main() {
          vec2 ratio = vec2(
            min((uPlaneSizes.x / uPlaneSizes.y) / (uImageSizes.x / uImageSizes.y), 1.0),
            min((uPlaneSizes.y / uPlaneSizes.x) / (uImageSizes.y / uImageSizes.x), 1.0)
          );
          vec2 uv = vec2(
            vUv.x * ratio.x + (1.0 - ratio.x) * 0.5,
            vUv.y * ratio.y + (1.0 - ratio.y) * 0.5
          );
          vec4 color = texture2D(tMap, uv);

          float d = roundedBoxSDF(vUv - 0.5, vec2(0.5 - uBorderRadius), uBorderRadius);
          float edgeSmooth = 0.002;
          float alpha = 1.0 - smoothstep(-edgeSmooth, edgeSmooth, d);

          gl_FragColor = vec4(color.rgb, alpha);
        }
      `,
      uniforms: {
        tMap: { value: texture },
        uPlaneSizes: { value: [0, 0] },
        uImageSizes: { value: [0, 0] },
        uSpeed: { value: 0 },
        uTime: { value: 100 * Math.random() },
        uBorderRadius: { value: this.borderRadius }
      },
      transparent: true
    });
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = this.image;
    img.onload = () => {
      texture.image = img;
      this.program.uniforms.uImageSizes.value = [img.naturalWidth, img.naturalHeight];
    };
  }
  createMesh() {
    this.plane = new Mesh(this.gl, { geometry: this.geometry, program: this.program });
    this.plane.setParent(this.scene);
  }
  createTitle() {
    this.title = new Title({ gl: this.gl, plane: this.plane, text: this.text, textColor: this.textColor, font: this.font });
  }
  update(scroll, direction) {
    this.plane.position.x = this.x - scroll.current - this.extra;

    const x = this.plane.position.x;
    const H = this.viewport.width / 2;

    if (this.bend === 0) {
      this.plane.position.y = 0;
      this.plane.rotation.z = 0;
    } else {
      const bAbs = Math.abs(this.bend);
      const R = (H * H + bAbs * bAbs) / (2 * bAbs);
      const effectiveX = Math.min(Math.abs(x), H);
      const arc = R - Math.sqrt(R * R - effectiveX * effectiveX);
      if (this.bend > 0) {
        this.plane.position.y = -arc;
        this.plane.rotation.z = -Math.sign(x) * Math.asin(effectiveX / R);
      } else {
        this.plane.position.y = arc;
        this.plane.rotation.z = Math.sign(x) * Math.asin(effectiveX / R);
      }
    }

    this.speed = scroll.current - scroll.last;
    this.program.uniforms.uTime.value += 0.02;
    this.program.uniforms.uSpeed.value = this.speed;

    const planeOffset = this.plane.scale.x / 2;
    const viewportOffset = this.viewport.width / 2;
    this.isBefore = this.plane.position.x + planeOffset < -viewportOffset;
    this.isAfter = this.plane.position.x - planeOffset > viewportOffset;
    if (direction === 'right' && this.isBefore) {
      this.extra -= this.widthTotal;
      this.isBefore = this.isAfter = false;
    }
    if (direction === 'left' && this.isAfter) {
      this.extra += this.widthTotal;
      this.isBefore = this.isAfter = false;
    }
  }
  onResize({ screen, viewport } = {}) {
    if (screen) this.screen = screen;
    if (viewport) this.viewport = viewport;
    this.scale = this.screen.height / 1500;
    this.plane.scale.y = (this.viewport.height * (960 * this.scale)) / this.screen.height;
    this.plane.scale.x = (this.viewport.width * (780 * this.scale)) / this.screen.width;
    this.plane.program.uniforms.uPlaneSizes.value = [this.plane.scale.x, this.plane.scale.y];
    this.padding = 2;
    this.width = this.plane.scale.x + this.padding;
    this.widthTotal = this.width * this.length;
    this.x = this.width * this.index;
  }
}

class GalleryApp {
  constructor(container, { items, bend, textColor = '#ffffff', borderRadius = 0, font = 'bold 30px sans-serif', scrollSpeed = 2, scrollEase = 0.05, onMediaClick } = {}) {
    autoBind(this);
    this.container = container;
    this.scrollSpeed = scrollSpeed;
    this.scroll = { ease: scrollEase, current: 0, target: 0, last: 0 };
    this.onMediaClick = onMediaClick;
    this.raycast = new Raycast();
    this.mouse = new Vec2();
    this.createRenderer();
    this.createCamera();
    this.createScene();
    this.onResize();
    this.createGeometry();
    this.createMedias(items, bend, textColor, borderRadius, font);
    this.update();
    this.addEventListeners();
  }
  createRenderer() {
    this.renderer = new Renderer({ alpha: true, antialias: true, dpr: Math.min(window.devicePixelRatio || 1, 2) });
    this.gl = this.renderer.gl;
    this.gl.clearColor(0, 0, 0, 0);
    this.container.appendChild(this.gl.canvas);
  }
  createCamera() {
    this.camera = new Camera(this.gl);
    this.camera.fov = 45;
    this.camera.position.z = 20;
  }
  createScene() {
    this.scene = new Transform();
  }
  createGeometry() {
    this.planeGeometry = new Plane(this.gl, { heightSegments: 50, widthSegments: 100 });
    this.planeGeometry.computeBoundingBox();
    this.planeGeometry.computeBoundingSphere();
  }
  createMedias(items, bend, textColor, borderRadius, font) {
    this.mediasImages = items.concat(items);
    this.medias = this.mediasImages.map((data, index) => new Media({
      geometry: this.planeGeometry,
      gl: this.gl,
      image: data.image,
      index,
      length: this.mediasImages.length,
      scene: this.scene,
      screen: this.screen,
      text: data.text,
      viewport: this.viewport,
      bend,
      textColor,
      borderRadius,
      font
    }));
  }
  onTouchDown(e) {
    this.isDown = true;
    this.scroll.position = this.scroll.current;
    const point = e.touches ? e.touches[0] : e;
    this.start = point.clientX;
    this.downX = point.clientX;
    this.downY = point.clientY;
  }
  onTouchMove(e) {
    if (!this.isDown) return;
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    const distance = (this.start - x) * (this.scrollSpeed * 0.025);
    this.scroll.target = this.scroll.position + distance;
  }
  onTouchUp(e) {
    this.isDown = false;
    this.onCheck();
    const point = e.changedTouches ? e.changedTouches[0] : e;
    const moved = Math.hypot(point.clientX - this.downX, point.clientY - this.downY);
    if (moved < 6) this.onClick(point.clientX, point.clientY);
  }
  onClick(clientX, clientY) {
    if (!this.onMediaClick || !this.medias) return;
    const rect = this.container.getBoundingClientRect();
    this.mouse.set(
      2 * ((clientX - rect.left) / rect.width) - 1,
      -(2 * ((clientY - rect.top) / rect.height) - 1)
    );
    this.raycast.castMouse(this.camera, this.mouse);
    const meshes = this.medias.map((media) => media.plane);
    const hits = this.raycast.intersectBounds(meshes);
    if (!hits.length) return;
    const media = this.medias.find((m) => m.plane === hits[0]);
    if (media) this.onMediaClick(media.image, media.text);
  }
  onWheel(e) {
    const delta = e.deltaY || e.wheelDelta || e.detail;
    this.scroll.target += (delta > 0 ? this.scrollSpeed : -this.scrollSpeed) * 0.2;
    this.onCheckDebounce();
  }
  onKeyDown(e) {
    if (e.key === 'ArrowRight') { e.preventDefault(); this.scroll.target += this.scrollSpeed * 5; this.onCheckDebounce(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); this.scroll.target -= this.scrollSpeed * 5; this.onCheckDebounce(); }
    else if (e.key === 'Home') { e.preventDefault(); this.scroll.target = 0; this.onCheckDebounce(); }
  }
  onCheck() {
    if (!this.medias || !this.medias[0]) return;
    const width = this.medias[0].width;
    const itemIndex = Math.round(Math.abs(this.scroll.target) / width);
    const item = width * itemIndex;
    this.scroll.target = this.scroll.target < 0 ? -item : item;
  }
  onResize() {
    this.screen = { width: this.container.clientWidth, height: this.container.clientHeight };
    this.renderer.setSize(this.screen.width, this.screen.height);
    this.camera.perspective({ aspect: this.screen.width / this.screen.height });
    const fov = (this.camera.fov * Math.PI) / 180;
    const height = 2 * Math.tan(fov / 2) * this.camera.position.z;
    const width = height * this.camera.aspect;
    this.viewport = { width, height };
    if (this.medias) this.medias.forEach((media) => media.onResize({ screen: this.screen, viewport: this.viewport }));
  }
  update() {
    this.scroll.current = lerp(this.scroll.current, this.scroll.target, this.scroll.ease);
    const direction = this.scroll.current > this.scroll.last ? 'right' : 'left';
    if (this.medias) this.medias.forEach((media) => media.update(this.scroll, direction));
    this.renderer.render({ scene: this.scene, camera: this.camera });
    this.scroll.last = this.scroll.current;
    this.raf = window.requestAnimationFrame(this.update);
  }
  addEventListeners() {
    let wheelTimer;
    this.onCheckDebounce = () => { clearTimeout(wheelTimer); wheelTimer = setTimeout(this.onCheck, 200); };
    window.addEventListener('resize', this.onResize);
    window.addEventListener('wheel', this.onWheel);
    window.addEventListener('mousedown', this.onTouchDown);
    window.addEventListener('mousemove', this.onTouchMove);
    window.addEventListener('mouseup', this.onTouchUp);
    window.addEventListener('touchstart', this.onTouchDown);
    window.addEventListener('touchmove', this.onTouchMove);
    window.addEventListener('touchend', this.onTouchUp);
    this.container.addEventListener('keydown', this.onKeyDown);
  }
  destroy() {
    window.cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('mousedown', this.onTouchDown);
    window.removeEventListener('mousemove', this.onTouchMove);
    window.removeEventListener('mouseup', this.onTouchUp);
    window.removeEventListener('touchstart', this.onTouchDown);
    window.removeEventListener('touchmove', this.onTouchMove);
    window.removeEventListener('touchend', this.onTouchUp);
    this.container.removeEventListener('keydown', this.onKeyDown);
    if (this.renderer && this.renderer.gl && this.renderer.gl.canvas.parentNode) {
      this.renderer.gl.canvas.parentNode.removeChild(this.renderer.gl.canvas);
    }
  }
}

/* Cor do texto segue --ink do tema ativo (claro/escuro), a pagina nunca
   inverte o tema so numa secao. */
function themeInk() {
  return getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#14100f';
}

/* ---------- lightbox (abre a foto em tela cheia ao clicar) ---------- */

let lightboxLastFocus = null;

function openLightbox(src, caption) {
  const overlay = document.getElementById('galleryLightbox');
  const img = document.getElementById('lightboxImg');
  const cap = document.getElementById('lightboxCaption');
  if (!overlay || !img) return;
  lightboxLastFocus = document.activeElement;
  img.src = src;
  img.alt = caption || '';
  if (cap) cap.textContent = caption || '';
  overlay.hidden = false;
  requestAnimationFrame(() => overlay.classList.add('is-open'));
  document.body.style.overflow = 'hidden';
  const closeBtn = document.getElementById('lightboxClose');
  if (closeBtn) closeBtn.focus();
}

function closeLightbox() {
  const overlay = document.getElementById('galleryLightbox');
  if (!overlay || overlay.hidden) return;
  overlay.classList.remove('is-open');
  document.body.style.overflow = '';
  setTimeout(() => { overlay.hidden = true; }, 250);
  if (lightboxLastFocus) lightboxLastFocus.focus();
}

document.addEventListener('DOMContentLoaded', function () {
  const overlay = document.getElementById('galleryLightbox');
  if (!overlay) return;
  const closeBtn = document.getElementById('lightboxClose');
  if (closeBtn) closeBtn.addEventListener('click', closeLightbox);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeLightbox(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLightbox(); });
});

document.addEventListener('DOMContentLoaded', function () {
  const container = document.getElementById('portfolioGallery');
  if (!container) return;

  const items = [
    { image: 'images/portfolio/nails1.jpg', text: 'Esmaltação em gel' },
    { image: 'images/portfolio/lash1.jpg', text: 'Lash designer' },
    { image: 'images/portfolio/brow1.jpg', text: 'Design de sobrancelha' },
    { image: 'images/portfolio/hair1.jpg', text: 'Tratamento capilar' },
    { image: 'images/portfolio/nails2.jpg', text: 'Pedicure' },
    { image: 'images/portfolio/space.jpg', text: 'O studio' },
    { image: 'images/portfolio/lash2.jpg', text: 'Produção especial' },
    { image: 'images/portfolio/hair2.jpg', text: 'Hair styling' }
  ];

  new GalleryApp(container, {
    items,
    bend: 7,
    borderRadius: 0.1,
    scrollSpeed: 1.8,
    scrollEase: 0.05,
    textColor: themeInk(),
    font: '600 26px "Cormorant Garamond", serif',
    onMediaClick: openLightbox
  });

  const hint = document.getElementById('galleryHint');
  if (hint) {
    const hideHint = () => { hint.classList.add('is-hidden'); };
    container.addEventListener('pointerdown', hideHint, { once: true });
    container.addEventListener('wheel', hideHint, { once: true, passive: true });
    container.addEventListener('touchstart', hideHint, { once: true, passive: true });
    container.addEventListener('keydown', hideHint, { once: true });
  }
});
