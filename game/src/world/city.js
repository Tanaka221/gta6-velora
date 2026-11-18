// Velora Bay itself: a 600 x 600 m coastal city on a road grid, a sandy beach and
// ocean to the east, a marina to the south, a downtown of towers, and suburbs.
// buildCity returns the colliders (building boxes), road lines, district names and
// every gameplay anchor (garage, shops, hospital, mission spots) the other
// systems need. Layout is seeded, so seed 1 always builds the same city.

import * as THREE from 'three';
import { mulberry32, pickRandom, rangeRandom } from '../util.js';

export const CITY_HALF = 300;        // playable city extent in metres
export const ROAD_STEP = 60;         // distance between road centrelines
export const BEACH_X = 262;          // sand starts here; ocean beyond x = 300

const PALETTE = [0xffd9a0, 0xffb703, 0xfb8500, 0x8ecae6, 0x219ebc, 0xffffff, 0xe07a5f, 0x90be6d];

// A canvas texture of lit windows, generated at runtime (no image files).
function makeFacadeTexture(baseColor, rng) {
  const cnv = document.createElement('canvas');
  cnv.width = 128; cnv.height = 256;
  const ctx = cnv.getContext('2d');
  ctx.fillStyle = '#' + baseColor.toString(16).padStart(6, '0');
  ctx.fillRect(0, 0, 128, 256);
  const cols = 6, rows = 14;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lit = rng() < 0.42;
      ctx.fillStyle = lit ? '#ffe9a8' : 'rgba(20,30,45,0.55)';
      ctx.fillRect(8 + c * 20, 10 + r * 17, 12, 10);
    }
  }
  const tex = new THREE.CanvasTexture(cnv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildCity(scene, seed) {
  const rng = mulberry32(seed);
  const city = {
    colliders: [],        // {minX,maxX,minZ,maxZ} building boxes
    roadsX: [], roadsZ: [], // road centreline coordinates
    buildings: [],
    palms: [],
    anchors: {},          // named gameplay spots
    bounds: CITY_HALF,
  };

  const groundMat = new THREE.MeshLambertMaterial({ color: 0x9aa08a });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(120, 0, 0);
  ground.receiveShadow = true;
  scene.add(ground);

  // Ocean to the east, sand between city and water.
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(500, 1400),
    new THREE.MeshLambertMaterial({ color: 0x1d7fb8 }));
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(560, -0.4, 0);
  scene.add(ocean);
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 1400),
    new THREE.MeshLambertMaterial({ color: 0xe8d29a }));
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(300, 0.05, 0);
  sand.receiveShadow = true;
  scene.add(sand);

  // Boardwalk along the beach.
  const boardwalk = new THREE.Mesh(
    new THREE.BoxGeometry(10, 0.4, 640),
    new THREE.MeshLambertMaterial({ color: 0xb08968 }));
  boardwalk.position.set(256, 0.2, 0);
  boardwalk.receiveShadow = true;
  scene.add(boardwalk);

  // Road grid: asphalt strips + pale centre dashes.
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x2e3138 });
  const dashMat = new THREE.MeshLambertMaterial({ color: 0xf5d76e });
  for (let i = -4; i <= 4; i++) {
    const c = i * ROAD_STEP;
    city.roadsX.push(c);
    city.roadsZ.push(c);
    const rx = new THREE.Mesh(new THREE.PlaneGeometry(12, 620), roadMat);
    rx.rotation.x = -Math.PI / 2; rx.position.set(c, 0.06, 0);
    rx.receiveShadow = true;
    scene.add(rx);
    const rz = new THREE.Mesh(new THREE.PlaneGeometry(620, 12), roadMat);
    rz.rotation.x = -Math.PI / 2; rz.position.set(0, 0.06, c);
    rz.receiveShadow = true;
    scene.add(rz);
    for (let d = -280; d <= 280; d += 24) {
      const dx = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 6), dashMat);
      dx.rotation.x = -Math.PI / 2; dx.position.set(c, 0.09, d);
      scene.add(dx);
      const dz = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.2), dashMat);
      dz.rotation.x = -Math.PI / 2; dz.position.set(d, 0.09, c);
      scene.add(dz);
    }
  }

  // Buildings: one per block cell, taller downtown (near 0,0), lower near the beach.
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x5a4a3a });
  const neonColors = [0xff2e88, 0x00e5ff, 0xffd23e, 0x7dff5e];
  for (let bx = -4; bx <= 3; bx++) {
    for (let bz = -4; bz <= 3; bz++) {
      const cx = bx * ROAD_STEP + ROAD_STEP / 2;
      const cz = bz * ROAD_STEP + ROAD_STEP / 2;
      if (cx > BEACH_X - 34) continue; // keep the beachfront open
      const distDowntown = Math.sqrt(cx * cx + cz * cz);
      const tall = distDowntown < 130;
      const h = tall ? rangeRandom(rng, 34, 78) : rangeRandom(rng, 10, 30);
      const w = rangeRandom(rng, 26, 40);
      const d = rangeRandom(rng, 26, 40);
      const base = pickRandom(rng, PALETTE);
      const tex = makeFacadeTexture(base, rng);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(Math.max(1, Math.round(w / 13)), Math.max(1, Math.round(h / 15)));
      const mat = new THREE.MeshLambertMaterial({ map: tex });
      const b = new THREE.Mesh(boxGeo, mat);
      b.scale.set(w, h, d);
      b.position.set(cx, h / 2, cz);
      b.castShadow = true; b.receiveShadow = true;
      scene.add(b);
      const roof = new THREE.Mesh(boxGeo, roofMat);
      roof.scale.set(w + 1, 1.2, d + 1);
      roof.position.set(cx, h + 0.6, cz);
      scene.add(roof);
      // A few downtown towers get a neon crown so the skyline reads at a glance.
      if (tall && rng() < 0.4) {
        const neon = new THREE.Mesh(
          new THREE.BoxGeometry(w * 0.9, 1.4, 1.4),
          new THREE.MeshBasicMaterial({ color: pickRandom(rng, neonColors) }));
        neon.position.set(cx, h + 1.8, cz - d / 2 + 1);
        scene.add(neon);
      }
      city.colliders.push({
        minX: cx - w / 2 - 0.5, maxX: cx + w / 2 + 0.5,
        minZ: cz - d / 2 - 0.5, maxZ: cz + d / 2 + 0.5,
      });
      city.buildings.push({ x: cx, z: cz, w, d, h });
    }
  }

  // Palm trees: beachfront rows and a few on the avenues.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6d3b });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2e9e5b });
  const trunkGeo = new THREE.CylinderGeometry(0.35, 0.55, 9, 6);
  const leafGeo = new THREE.ConeGeometry(3.2, 3.4, 6);
  function plantPalm(x, z) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 4.5; trunk.castShadow = true;
    g.add(trunk);
    const leaves = new THREE.Mesh(leafGeo, leafMat);
    leaves.position.y = 10; leaves.castShadow = true;
    g.add(leaves);
    g.position.set(x, 0, z);
    g.rotation.z = rangeRandom(rng, -0.08, 0.08);
    scene.add(g);
    city.palms.push(g);
    city.colliders.push({ minX: x - 0.7, maxX: x + 0.7, minZ: z - 0.7, maxZ: z + 0.7 });
  }
  for (let z = -280; z <= 280; z += 28) plantPalm(268, z);
  for (let z = -240; z <= 240; z += 60) { plantPalm(-246, z); plantPalm(246, z); }

  // Streetlights along the main avenues.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3f45 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  const poleGeo = new THREE.CylinderGeometry(0.18, 0.18, 7, 6);
  const lampGeo = new THREE.SphereGeometry(0.7, 8, 6);
  for (const x of [-180, -60, 60, 180]) {
    for (let z = -240; z <= 240; z += 60) {
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(x + 8, 3.5, z);
      scene.add(pole);
      const lamp = new THREE.Mesh(lampGeo, lampMat);
      lamp.position.set(x + 8, 7.2, z);
      scene.add(lamp);
    }
  }

  // Marina: wooden pier + moored boats at the south beach.
  const pier = new THREE.Mesh(
    new THREE.BoxGeometry(8, 0.6, 90),
    new THREE.MeshLambertMaterial({ color: 0x8a6d4b }));
  pier.position.set(300, 0.4, 220);
  scene.add(pier);
  const hullMat = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 });
  const hullMat2 = new THREE.MeshLambertMaterial({ color: 0xff6b6b });
  for (let i = 0; i < 5; i++) {
    const boat = new THREE.Mesh(new THREE.BoxGeometry(5, 2, 14), i % 2 ? hullMat : hullMat2);
    boat.position.set(318 + (i % 2) * 10, 0.6, 190 + i * 18);
    boat.rotation.y = (rng() - 0.5) * 0.2;
    scene.add(boat);
  }

  // Gameplay anchors (all on roads, clear of buildings).
  city.anchors = {
    spawn: { x: 0, z: 120, heading: Math.PI },          // outside Marco's garage
    garage: { x: -30, z: 120, label: "Marco's Garage" },
    gunShop: { x: 60, z: -60, label: 'Velora Arms' },
    foodShop: { x: -60, z: 60, label: 'Taco Sol' },
    hospital: { x: -120, z: -180, label: 'Velora General' },
    pier: { x: 296, z: 220, label: 'Marina Pier' },
    plaza: { x: 0, z: 0, label: 'Sol Plaza' },
    docks: { x: -240, z: 240, label: 'South Docks' },
    penthouse: { x: 180, z: -180, label: 'Reyes Penthouse' },
    vault: { x: 240, z: 180, label: 'Marina Vault' },
    beach: { x: 250, z: -120, label: 'Coral Beach' },
  };

  // Glowing shop signs: coloured boxes with a bright face, readable from afar.
  function addSign(anchor, color, text) {
    const g = new THREE.Group();
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(10, 3, 1),
      new THREE.MeshBasicMaterial({ color }));
    board.position.y = 9;
    g.add(board);
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, 9, 6), poleMat);
    pole.position.y = 4.5;
    g.add(pole);
    g.position.set(anchor.x, 0, anchor.z);
    g.userData.label = text;
    scene.add(g);
    return g;
  }
  addSign(city.anchors.garage, 0xffd23e, "Marco's Garage");
  addSign(city.anchors.gunShop, 0xff2e88, 'Velora Arms');
  addSign(city.anchors.foodShop, 0x7dff5e, 'Taco Sol');
  addSign(city.anchors.hospital, 0x7db4ff, 'Hospital');

  return city;
}

// A point on a road centreline, for spawning cars and pedestrians.
export function roadPoint(rng, city) {
  const horizontal = rng() < 0.5;
  const line = city.roadsX[Math.floor(rng() * city.roadsX.length)];
  const along = (rng() * 2 - 1) * 260;
  return horizontal ? { x: along, z: line } : { x: line, z: along };
}

export function districtName(x, z) {
  if (x > 240) return 'Coral Beach';
  if (Math.abs(x) < 130 && Math.abs(z) < 130) return 'Downtown';
  if (z > 150) return 'South Docks';
  if (x < -150) return 'Old Town';
  if (z < -150) return 'North Hills';
  return 'Velora Bay';
}
