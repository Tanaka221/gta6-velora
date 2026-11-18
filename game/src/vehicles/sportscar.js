// Sports-car models for VELORA BAY: low, wide, sleek silhouettes built from
// boxes and wedges — a coupe, a supercar and a muscle car — so a stolen car
// reads as a sports car at a glance instead of a plain box. Each style has its
// own stance, spoiler, lights and rims; the police interceptor reuses the
// supercar body in VBPD navy. Front of the car is +z (headlights), rear is -z.

import * as THREE from 'three';

const GLASS = 0x141e28;
const TRIM = 0x151515;
const RIM = 0xc8ccd2;

function box(w, h, d, mat, x, y, z, rx = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  if (rx) m.rotation.x = rx;
  m.castShadow = true;
  return m;
}

function makeWheel(x, z) {
  // Tyre + visible light rim, on the car's left/right flanks.
  const g = new THREE.Group();
  const tyre = new THREE.Mesh(
    new THREE.CylinderGeometry(0.44, 0.44, 0.34, 12),
    new THREE.MeshLambertMaterial({ color: 0x0d0d0d }),
  );
  tyre.rotation.z = Math.PI / 2;
  tyre.castShadow = true;
  g.add(tyre);
  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.26, 0.26, 0.36, 8),
    new THREE.MeshLambertMaterial({ color: RIM }),
  );
  rim.rotation.z = Math.PI / 2;
  g.add(rim);
  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.1, 0.38, 6),
    new THREE.MeshLambertMaterial({ color: 0x333333 }),
  );
  hub.rotation.z = Math.PI / 2;
  g.add(hub);
  g.position.set(x, 0.44, z);
  g.userData.spin = tyre;
  return g;
}

function addLights(group, bodyMat) {
  // Long slim headlights up front, full-width red bar at the rear.
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6c8 });
  for (const hx of [-0.72, 0.72]) {
    group.add(box(0.62, 0.16, 0.08, headMat, hx, 0.62, 2.31));
  }
  const strip = new THREE.Mesh(
    new THREE.BoxGeometry(1.9, 0.18, 0.08),
    new THREE.MeshBasicMaterial({ color: 0xff2a2a }),
  );
  strip.position.set(0, 0.66, -2.31);
  group.add(strip);
  // Front splitter + side skirts in dark trim.
  group.add(box(2.1, 0.16, 0.5, new THREE.MeshLambertMaterial({ color: TRIM }), 0, 0.32, 2.15));
  for (const sx of [-1.08, 1.08]) {
    group.add(box(0.1, 0.18, 2.6, new THREE.MeshLambertMaterial({ color: TRIM }), sx, 0.3, 0));
  }
  void bodyMat;
}

function addSpoiler(group, mat, kind) {
  if (kind === 'supercar') {
    // Big GT wing on two struts, high over the rear deck.
    for (const sx of [-0.7, 0.7]) {
      group.add(box(0.12, 0.5, 0.12, mat, sx, 1.05, -2.0));
    }
    group.add(box(2.1, 0.1, 0.55, mat, 0, 1.32, -2.05));
    group.add(box(2.1, 0.22, 0.08, mat, 0, 1.22, -2.3));
  } else if (kind === 'muscle') {
    // Ducktail lip on the rear deck.
    group.add(box(2.0, 0.12, 0.4, mat, 0, 1.02, -2.15, -0.35));
  } else {
    // Coupe: small lip spoiler.
    group.add(box(1.9, 0.1, 0.35, mat, 0, 1.0, -2.1, -0.2));
  }
}

// style: 'coupe' | 'supercar' | 'muscle'. Returns a THREE.Group with
// userData.wheels (the tyre meshes, spun by the driving code).
export function buildSportsCarMesh(color, style = 'coupe') {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const glassMat = new THREE.MeshLambertMaterial({ color: GLASS });
  const trimMat = new THREE.MeshLambertMaterial({ color: TRIM });

  if (style === 'supercar') {
    // Very low, long nose, cabin set far back, wide rear haunches.
    group.add(box(2.2, 0.5, 4.7, bodyMat, 0, 0.55, 0));
    // Sloped nose wedge.
    group.add(box(2.15, 0.34, 1.1, bodyMat, 0, 0.62, 1.95, 0.28));
    // Low glasshouse, swept back.
    group.add(box(1.6, 0.5, 1.7, glassMat, 0, 1.0, -0.55, -0.12));
    // Rear haunches over the back wheels.
    for (const hx of [-0.95, 0.95]) {
      group.add(box(0.35, 0.42, 1.1, bodyMat, hx, 0.72, -1.5));
    }
    // Centre roof stripe in trim black.
    group.add(box(0.5, 0.06, 2.6, trimMat, 0, 0.82, -0.1));
    // Side air intakes behind the doors.
    for (const sx of [-1.12, 1.12]) {
      group.add(box(0.08, 0.4, 0.9, trimMat, sx, 0.62, -0.9));
    }
    // Twin exhausts.
    for (const ex of [-0.35, 0.35]) {
      const pipe = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.11, 0.3, 8),
        new THREE.MeshLambertMaterial({ color: 0x888888 }),
      );
      pipe.rotation.x = Math.PI / 2;
      pipe.position.set(ex, 0.45, -2.38);
      group.add(pipe);
    }
  } else if (style === 'muscle') {
    // Tall long hood with a scoop, upright cabin, fat rear tyres.
    group.add(box(2.2, 0.72, 4.6, bodyMat, 0, 0.66, 0));
    group.add(box(1.0, 0.3, 1.0, bodyMat, 0, 1.12, 1.15));
    group.add(box(0.7, 0.16, 0.7, trimMat, 0, 1.28, 1.15));
    group.add(box(1.75, 0.62, 2.0, glassMat, 0, 1.28, -0.35));
    // Chrome bumpers front and rear.
    group.add(box(2.24, 0.2, 0.18, new THREE.MeshLambertMaterial({ color: 0xb9bec6 }), 0, 0.5, 2.32));
    group.add(box(2.24, 0.2, 0.18, new THREE.MeshLambertMaterial({ color: 0xb9bec6 }), 0, 0.5, -2.32));
    // Twin racing stripes down the middle.
    for (const sx of [-0.28, 0.28]) {
      group.add(box(0.22, 0.06, 4.4, trimMat, sx, 1.03, 0.1));
    }
  } else {
    // Coupe: balanced grand-tourer shape, sloping fastback roof.
    group.add(box(2.15, 0.62, 4.5, bodyMat, 0, 0.62, 0));
    group.add(box(2.1, 0.36, 1.2, bodyMat, 0, 0.66, 1.85, 0.22));
    group.add(box(1.65, 0.55, 2.1, glassMat, 0, 1.16, -0.35, -0.1));
    // Two-tone roof panel in dark trim.
    group.add(box(1.5, 0.08, 1.9, trimMat, 0, 1.44, -0.35, -0.1));
    // Long side character line.
    for (const sx of [-1.09, 1.09]) {
      group.add(box(0.08, 0.1, 3.2, trimMat, sx, 0.72, 0));
    }
  }

  addSpoiler(group, bodyMat, style);
  addLights(group, bodyMat);

  const wheels = [];
  const wheelZ = style === 'muscle' ? [[-1.02, 1.5], [1.02, 1.5], [-1.05, -1.5], [1.05, -1.5]] : [[-1.0, 1.5], [1.0, 1.5], [-1.0, -1.5], [1.0, -1.5]];
  for (const [wx, wz] of wheelZ) {
    const w = makeWheel(wx, wz);
    group.add(w);
    wheels.push(w.userData.spin);
  }
  group.userData.wheels = wheels;
  return group;
}

// The three sports silhouettes the city spawns, with their paint names.
export const SPORTS_STYLES = ['coupe', 'supercar', 'muscle'];
