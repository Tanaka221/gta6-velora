// Vehicles for Velora Bay: a car factory that builds every car from boxes
// (body, cabin, wheels, lights), traffic cars that cruise the road grid,
// pedestrians strolling the sidewalks, and the arcade driving model the player
// uses after stealing a car with E.

import * as THREE from 'three';
import { clamp, distance2D, mulberry32, pickRandom, rangeRandom, resolveCircleColliders } from '../util.js';
import { roadPoint } from '../world/city.js';
import { makePedestrianFigure } from '../player.js';
import { buildSportsCarMesh, SPORTS_STYLES } from './sportscar.js';

const CAR_COLORS = [0xd62828, 0x2a9d8f, 0x1d3557, 0xf4d35e, 0xffffff, 0x222222, 0x7b2cbf, 0xef476f];
const CAR_NAMES = ['Comet', 'Vagabond', 'Sunrunner', 'Marlin GT', 'Bay Cruiser', 'Striker', 'Lowrider'];

function buildCarMesh(color, kind) {
  // Sports silhouettes get the dedicated low, wide builder.
  if (kind === 'sports' || kind === 'supercar' || kind === 'muscle') {
    return buildSportsCarMesh(color, kind === 'sports' ? 'coupe' : kind);
  }
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x18242e });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.75, 4.4), bodyMat);
  body.position.y = 0.65; body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.65, 2.2), glassMat);
  cabin.position.set(0, 1.3, -0.2); cabin.castShadow = true;
  group.add(cabin);
  if (kind === 'sports') {
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.12, 0.4), bodyMat);
    spoiler.position.set(0, 1.15, -2.1);
    group.add(spoiler);
  }
  if (kind === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xffd23e }));
    sign.position.set(0, 1.85, -0.2);
    group.add(sign);
  }
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.42, wz);
    group.add(w);
    wheels.push(w);
  }
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const hx of [-0.6, 0.6]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.1), headMat);
    h.position.set(hx, 0.7, 2.22);
    group.add(h);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
  for (const tx of [-0.6, 0.6]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.1), tailMat);
    t.position.set(tx, 0.7, -2.22);
    group.add(t);
  }
  group.userData.wheels = wheels;
  return group;
}

export function createCar(scene, x, z, heading, opts = {}) {
  const rng = opts.rng || Math.random;
  const color = opts.color ?? pickRandom(rng, CAR_COLORS);
  const kind = opts.kind || pickRandom(rng, ['sedan', 'sedan', ...SPORTS_STYLES, 'taxi']);
  const mesh = buildCarMesh(color, kind);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  scene.add(mesh);
  const isSports = kind === 'sports' || kind === 'supercar' || kind === 'muscle';
  return {
    mesh, kind,
    name: opts.name || pickRandom(rng, CAR_NAMES),
    color,
    x, z, heading,
    speed: 0,
    topSpeed: kind === 'supercar' ? 38 : isSports ? 34 : kind === 'taxi' ? 24 : 27,
    accel: kind === 'supercar' ? 18 : isSports ? 16 : 11,
    isPlayerCar: false,
    isPolice: false,
    driver: null, // 'player' | 'traffic' | null (parked)
    stolen: false,
  };
}

// Drive one car with arcade physics: accelerate, steer (steering weakens at speed),
// brake/reverse, collide with buildings, and stay inside the city.
export function driveCar(car, input, dt, colliders) {
  const fwd = input.pressed('up') ? 1 : input.pressed('down') ? -0.55 : 0;
  const steer = (input.pressed('left') ? 1 : 0) - (input.pressed('right') ? 1 : 0);
  if (fwd > 0) car.speed += car.accel * dt;
  else if (fwd < 0) car.speed -= car.accel * 0.7 * dt;
  else car.speed *= Math.max(0, 1 - dt * 0.8); // coast
  car.speed = clamp(car.speed, -10, car.topSpeed);
  const turnRate = steer * 1.9 * clamp(Math.abs(car.speed) / 8, 0, 1) * (car.speed < 0 ? -1 : 1);
  car.heading += turnRate * dt;
  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  const fixed = resolveCircleColliders(nx, nz, 1.6, colliders);
  if (fixed.x !== nx || fixed.z !== nz) car.speed *= 0.4; // scrape: lose speed
  car.x = clamp(fixed.x, -295, 295);
  car.z = clamp(fixed.z, -295, 295);
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  // Wheel spin + a little body roll into corners.
  const spin = car.speed * dt * 2.4;
  for (const w of car.mesh.userData.wheels) w.rotation.x += spin;
  car.mesh.rotation.z = -steer * clamp(Math.abs(car.speed) / 30, 0, 1) * 0.06;
  return Math.abs(car.speed);
}

export function createTraffic(scene, city, seed) {
  const rng = mulberry32(seed + 77);
  const traffic = {
    cars: [],      // moving traffic cars
    parked: [],    // stealable parked cars
    peds: [],      // pedestrians
    rng,
  };

  // Moving traffic: each car owns one road line and cruises along it, wrapping
  // at the city edge. Lane offset keeps them on the right-hand side.
  for (let i = 0; i < 14; i++) {
    const p = roadPoint(rng, city);
    const horizontal = Math.abs(p.z % 60) < 1;
    const car = createCar(scene, p.x, p.z, horizontal ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng() < 0.5 ? 0 : Math.PI), { rng, kind: pickRandom(rng, ['sedan', 'sedan', ...SPORTS_STYLES, 'taxi']) });
    car.driver = 'traffic';
    car.horizontal = horizontal;
    car.speed = rangeRandom(rng, 8, 13);
    car.lane = (rng() < 0.5 ? 1 : -1) * 2.6;
    traffic.cars.push(car);
  }

  // Parked cars along the roads: the ones the player steals.
  const parkedSpots = [
    { x: 6, z: 120 }, { x: -6, z: 96 }, { x: 126, z: 6 }, { x: 66, z: -6 },
    { x: -126, z: -6 }, { x: 6, z: -186 }, { x: -186, z: 6 }, { x: 186, z: 126 },
    { x: 66, z: 186 }, { x: -66, z: -126 }, { x: 246, z: 66 }, { x: 126, z: -186 },
  ];
  for (const s of parkedSpots) {
    const car = createCar(scene, s.x, s.z, rng() < 0.5 ? 0 : Math.PI / 2, { rng, kind: pickRandom(rng, ['sedan', 'sports', 'supercar', 'muscle', 'sports']) });
    car.driver = null;
    traffic.parked.push(car);
  }

  // Pedestrians wandering the sidewalks.
  const shirtColors = [0xe63946, 0x457b9d, 0x2a9d8f, 0xf4a261, 0xe9c46a, 0x9b5de5];
  for (let i = 0; i < 22; i++) {
    const p = roadPoint(rng, city);
    const fig = makePedestrianFigure(scene, pickRandom(rng, shirtColors), pickRandom(rng, [0x222222, 0x3a5a40, 0x6d6875]));
    fig.group.position.set(p.x + rangeRandom(rng, -8, 8), 0, p.z + rangeRandom(rng, -8, 8));
    const ped = {
      fig,
      x: fig.group.position.x, z: fig.group.position.z,
      heading: rng() * Math.PI * 2,
      speed: rangeRandom(rng, 1.2, 2.2),
      targetX: p.x, targetZ: p.z,
      phase: rng() * 6,
      alive: true,
    };
    traffic.peds.push(ped);
  }

  traffic.update = function updateTraffic(dt, game) {
    // Traffic cars cruise their road line; slow down for the car ahead.
    for (const car of traffic.cars) {
      let targetSpeed = car.baseSpeed || (car.baseSpeed = car.speed);
      for (const other of traffic.cars) {
        if (other === car) continue;
        if (other.horizontal !== car.horizontal) continue;
        const ahead = car.horizontal
          ? (other.z - car.z) * Math.sign(Math.sin(car.heading))
          : (other.x - car.x) * Math.sign(Math.sin(car.heading));
        const lateral = car.horizontal ? Math.abs(other.x - car.x) : Math.abs(other.z - car.z);
        if (ahead > 0 && ahead < 12 && lateral < 5) targetSpeed = Math.min(targetSpeed, other.speed * 0.8);
      }
      car.speed += (targetSpeed - car.speed) * dt * 0.8;
      if (car.horizontal) {
        car.x += Math.sin(car.heading) * car.speed * dt;
        car.z = Math.round(car.z / 60) * 60 + car.lane;
        if (car.x > 290) car.x = -290;
        if (car.x < -290) car.x = 290;
      } else {
        car.z += Math.cos(car.heading) * car.speed * dt;
        car.x = Math.round(car.x / 60) * 60 + car.lane;
        if (car.z > 290) car.z = -290;
        if (car.z < -290) car.z = 290;
      }
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
      for (const w of car.mesh.userData.wheels) w.rotation.x += car.speed * dt * 2.4;
    }
    // Pedestrians pick a new nearby waypoint when they arrive.
    for (const ped of traffic.peds) {
      if (!ped.alive) continue;
      const d = distance2D(ped.x, ped.z, ped.targetX, ped.targetZ);
      if (d < 1.5) {
        ped.targetX = clamp(ped.x + rangeRandom(rng, -40, 40), -280, 280);
        ped.targetZ = clamp(ped.z + rangeRandom(rng, -40, 40), -280, 280);
      }
      const dx = ped.targetX - ped.x, dz = ped.targetZ - ped.z;
      const len = Math.hypot(dx, dz) || 1;
      ped.x += (dx / len) * ped.speed * dt;
      ped.z += (dz / len) * ped.speed * dt;
      ped.heading = Math.atan2(dx, dz);
      ped.phase += dt * ped.speed * 3;
      ped.fig.group.position.set(ped.x, 0, ped.z);
      ped.fig.group.rotation.y = ped.heading;
      ped.fig.legL.rotation.x = Math.sin(ped.phase) * 0.5;
      ped.fig.legR.rotation.x = -Math.sin(ped.phase) * 0.5;
      // Flee from the player's car.
      if (game && game.playerCar) {
        const dd = distance2D(ped.x, ped.z, game.playerCar.x, game.playerCar.z);
        if (dd < 10 && Math.abs(game.playerCar.speed) > 5) {
          ped.targetX = ped.x + (ped.x - game.playerCar.x);
          ped.targetZ = ped.z + (ped.z - game.playerCar.z);
        }
      }
    }
  };

  traffic.nearestParkedCar = function nearestParkedCar(x, z, maxDist) {
    let best = null, bestD = maxDist;
    for (const car of traffic.parked) {
      if (car.driver) continue;
      const d = distance2D(x, z, car.x, car.z);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  };

  traffic.nearestPed = function nearestPed(x, z, maxDist) {
    let best = null, bestD = maxDist;
    for (const ped of traffic.peds) {
      if (!ped.alive) continue;
      const d = distance2D(x, z, ped.x, ped.z);
      if (d < bestD) { bestD = d; best = ped; }
    }
    return best;
  };

  return traffic;
}
