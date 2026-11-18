// Sky, sun and lighting for Velora Bay: a warm late-afternoon sun over the coast,
// a gradient sky dome, drifting clouds and the haze that makes the city read
// as a sun-soaked place in every screenshot.

import * as THREE from 'three';
import { mulberry32 } from '../util.js';

export function createSky(scene, seed) {
  const rng = mulberry32(seed);
  const sky = {};

  // Gradient dome: pale horizon warming to deep blue overhead.
  const skyGeo = new THREE.SphereGeometry(900, 24, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(0x2f7fc4) },
      mid: { value: new THREE.Color(0x8ec9e8) },
      low: { value: new THREE.Color(0xffd9a0) },
    },
    vertexShader: `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      varying vec3 vPos;
      uniform vec3 top; uniform vec3 mid; uniform vec3 low;
      void main() {
        float h = normalize(vPos).y;
        vec3 c = h > 0.25 ? mix(mid, top, smoothstep(0.25, 0.85, h))
                          : mix(low, mid, smoothstep(-0.05, 0.25, h));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const dome = new THREE.Mesh(skyGeo, skyMat);
  scene.add(dome);
  sky.dome = dome;

  // Sun disc + glow sprite, low in the west so buildings throw long shadows.
  const sunDir = new THREE.Vector3(-0.55, 0.42, -0.35).normalize();
  const sun = new THREE.DirectionalLight(0xffe6b8, 2.6);
  sun.position.copy(sunDir).multiplyScalar(420);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -260; sun.shadow.camera.right = 260;
  sun.shadow.camera.top = 260; sun.shadow.camera.bottom = -260;
  sun.shadow.camera.near = 50; sun.shadow.camera.far = 900;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  scene.add(sun.target);
  sky.sun = sun;
  sky.sunDir = sunDir;

  const hemi = new THREE.HemisphereLight(0xbfdfff, 0x8a6f4d, 0.9);
  scene.add(hemi);
  sky.hemi = hemi;

  scene.fog = new THREE.Fog(0xcfe4ef, 320, 850);

  // Sun billboard: a soft radial disc drawn once on a canvas, reused as a sprite.
  const cnv = document.createElement('canvas');
  cnv.width = cnv.height = 128;
  const ctx = cnv.getContext('2d');
  const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,246,200,1)');
  grad.addColorStop(0.35, 'rgba(255,214,120,0.85)');
  grad.addColorStop(1, 'rgba(255,180,80,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(cnv);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, transparent: true, depthWrite: false, fog: false,
  }));
  sprite.position.copy(sunDir).multiplyScalar(820);
  sprite.scale.set(180, 180, 1);
  scene.add(sprite);

  // Drifting clouds: flat white puff groups, slow and cheap.
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
  sky.clouds = [];
  for (let i = 0; i < 14; i++) {
    const group = new THREE.Group();
    const puffs = 3 + Math.floor(rng() * 3);
    for (let p = 0; p < puffs; p++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(8 + rng() * 10, 8, 6), cloudMat);
      s.position.set((p - puffs / 2) * 12 + rng() * 6, rng() * 3, rng() * 8 - 4);
      s.scale.y = 0.45;
      group.add(s);
    }
    group.position.set(rng() * 1400 - 700, 150 + rng() * 70, rng() * 1400 - 700);
    scene.add(group);
    sky.clouds.push(group);
  }

  sky.update = function updateSky(dt, t) {
    for (const c of sky.clouds) {
      c.position.x += dt * 1.6;
      if (c.position.x > 760) c.position.x = -760;
    }
    // Gentle sun shimmer so still screenshots still feel alive.
    sun.intensity = 2.6 + Math.sin(t * 0.4) * 0.05;
  };

  return sky;
}
