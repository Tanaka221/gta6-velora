// The Velora Bay Police Department: a wanted level from 0 to 5 stars, police
// cruisers that spawn and ram the player, officers on foot, and a police
// helicopter with a searchlight at 3 stars and up. Crimes raise the heat;
// staying clean and out of sight lets it cool down. Getting caught on foot
// means BUSTED; losing all health means WASTED.

import * as THREE from 'three';
import { clamp, distance2D, lerpAngle, mulberry32 } from './util.js';
import { createCar } from './vehicles/traffic.js';
import { makePedestrianFigure } from './player.js';

const WANTED_DECAY = 0.012;      // stars lost per second while clean
const BUST_TIMER = 2.0;          // seconds a cop must touch the player to bust

export function createPolice(scene, city, seed, game) {
  const rng = mulberry32(seed + 991);
  const police = {
    cruisers: [],
    officers: [],
    roadblocks: [],   // { car, officers } pairs parked across the road
    helis: [],
    heli: null,       // first helicopter, for backwards compatibility
    bustTimer: 0,
    spawnTimer: 0,
    sirenOn: false,
  };

  function buildPoliceCar(x, z, heading) {
    // VBPD interceptor: the sports-coupe body in navy, so pursuers read as
    // fast police cars, not the same boxes as traffic.
    const car = createCar(scene, x, z, heading, { rng, kind: 'sports', color: 0x1d3557, name: 'VBPD Interceptor' });
    car.isPolice = true;
    car.driver = 'police';
    car.topSpeed = 36;
    // White door panels: the VBPD livery.
    const doorMat = new THREE.MeshLambertMaterial({ color: 0xf5f5f5 });
    for (const sx of [-1.09, 1.09]) {
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 1.7), doorMat);
      door.position.set(sx, 0.62, 0.1);
      car.mesh.add(door);
    }
    // Light bar: red + blue flashers on the roof.
    const barMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.25, 0.5), barMat);
    bar.position.set(-0.3, 1.55, -0.35);
    car.mesh.add(bar);
    const bar2 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.25, 0.5),
      new THREE.MeshBasicMaterial({ color: 0x2266ff }));
    bar2.position.set(0.3, 1.55, -0.35);
    car.mesh.add(bar2);
    car.lightRed = bar; car.lightBlue = bar2;
    return car;
  }

  function buildHelicopter(cfg) {
    const g = new THREE.Group();
    const navy = new THREE.MeshLambertMaterial({ color: 0x1d3557 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.6, 5.5), navy);
    body.castShadow = true;
    g.add(body);
    // White belly stripe + glass nose so it reads as a police heli.
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.4, 3.0),
      new THREE.MeshLambertMaterial({ color: 0xf5f5f5 }));
    stripe.position.y = -0.4;
    g.add(stripe);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.0, 1.2),
      new THREE.MeshLambertMaterial({ color: 0x18242e }));
    nose.position.set(0, 0.1, 2.6);
    g.add(nose);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 5), navy);
    tail.position.set(0, 0.3, -5);
    g.add(tail);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.6, 1.2), navy);
    fin.position.set(0, 1.0, -7.2);
    g.add(fin);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.12, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x222222 }));
    rotor.position.y = 1.2;
    g.add(rotor);
    const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.2, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x222222 }));
    tailRotor.position.set(0.5, 0.4, -7.2);
    g.add(tailRotor);
    // Searchlight cone under the belly, aimed at the ground.
    const lamp = new THREE.Mesh(new THREE.ConeGeometry(cfg.coneRadius, cfg.coneLength, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: cfg.coneOpacity, side: THREE.DoubleSide }));
    lamp.position.y = -cfg.coneLength / 2;
    lamp.rotation.x = Math.PI;
    g.add(lamp);
    // Flashing red beacon on the tail.
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    beacon.position.set(0, 1.0, -7.2);
    g.add(beacon);
    g.visible = false;
    scene.add(g);
    return {
      group: g, rotor, tailRotor, lamp, beacon,
      x: 0, z: 0, y: cfg.height, angle: cfg.phase,
      minWanted: cfg.minWanted, orbitRadius: cfg.orbitRadius,
      orbitSpeed: cfg.orbitSpeed, height: cfg.height,
    };
  }
  // Heli 1 at 3 stars, heli 2 joins at 4 stars — closer, lower, opposite orbit.
  police.helis.push(buildHelicopter({ minWanted: 3, orbitRadius: 16, height: 24, orbitSpeed: 0.5, phase: 0, coneRadius: 3, coneLength: 20, coneOpacity: 0.18 }));
  police.helis.push(buildHelicopter({ minWanted: 4, orbitRadius: 12, height: 19, orbitSpeed: -0.65, phase: Math.PI, coneRadius: 4, coneLength: 16, coneOpacity: 0.26 }));
  police.heli = police.helis[0];

  function spawnCruiserNear(px, pz, heading, distScale = 1) {
    // Converge from all around: a wide arc behind the player plus the flanks,
    // so pursuers close in from several directions instead of one tail.
    let posAngle, carHeading;
    if (heading === undefined) {
      posAngle = rng() * Math.PI * 2;
      carHeading = posAngle;
    } else {
      posAngle = heading + Math.PI + (rng() - 0.5) * 2.6;
      carHeading = heading + (rng() - 0.5) * 0.6;
    }
    const d = (20 + rng() * 12) * distScale;
    const car = buildPoliceCar(px + Math.sin(posAngle) * d, pz + Math.cos(posAngle) * d, carHeading);
    car.speed = 22;
    police.cruisers.push(car);
  }

  // Stage a chase instantly (used by screenshot mode): N cruisers right on the player.
  police.stageChase = function stageChase(px, pz, count, heading, distScale = 1) {
    for (let i = 0; i < count; i++) spawnCruiserNear(px, pz, heading, distScale);
    police.spawnTimer = 1.2;
  };

  // Roadblock: two interceptors parked across the road ahead of the player,
  // with two officers standing by — staged at 3+ stars, cleared below that.
  police.stageRoadblock = function stageRoadblock(px, pz, heading) {
    if (police.roadblocks.length > 0) return;
    const ahead = 42;
    const bx = px + Math.sin(heading) * ahead;
    const bz = pz + Math.cos(heading) * ahead;
    const across = heading + Math.PI / 2;
    const block = { cars: [], officers: [] };
    for (const side of [-3.4, 3.4]) {
      const car = buildPoliceCar(
        bx + Math.sin(across) * side, bz + Math.cos(across) * side, across);
      car.driver = 'roadblock';
      car.speed = 0;
      block.cars.push(car);
    }
    for (const side of [-6.5, 6.5]) {
      const fig = makePedestrianFigure(scene, 0x1d3557, 0x1a1a1a);
      fig.group.position.set(bx + Math.sin(across) * side, 0, bz + Math.cos(across) * side);
      fig.group.rotation.y = across + Math.PI;
      block.officers.push(fig);
      police.officers.push(fig);
    }
    police.roadblocks.push(block);
  };

  police.clearRoadblocks = function clearRoadblocks() {
    for (const block of police.roadblocks) {
      for (const car of block.cars) scene.remove(car.mesh);
      for (const fig of block.officers) {
        scene.remove(fig.group);
        const i = police.officers.indexOf(fig);
        if (i >= 0) police.officers.splice(i, 1);
      }
    }
    police.roadblocks.length = 0;
  };

  police.addWanted = function addWanted(stars) {
    game.wanted = clamp(game.wanted + stars, 0, 5);
    game.lastCrimeTime = game.time;
  };

  police.update = function updatePolice(dt) {
    const wanted = game.wanted;
    const px = game.player.x, pz = game.player.z;
    const inCar = !!game.playerCar;

    // Cool down when the player has been clean for a while.
    if (wanted > 0 && game.time - game.lastCrimeTime > 18) {
      game.wanted = Math.max(0, wanted - WANTED_DECAY * dt * 4);
    }

    // Spawn cruisers up to the wanted level's allowance: a real pack, not
    // one car — 4 at 1 star, 6 at 2, 8 at 3, 9 at 4-5 stars.
    const wantCruisers = wanted >= 1 ? Math.min(2 + Math.floor(wanted) * 2, 9) : 0;
    police.spawnTimer -= dt;
    if (police.cruisers.length < wantCruisers && police.spawnTimer <= 0) {
      spawnCruiserNear(px, pz);
      police.spawnTimer = 1.1;
    }
    // Roadblocks while the heat is 3+; cleared as soon as it drops.
    if (wanted >= 3 && police.roadblocks.length === 0) {
      police.stageRoadblock(px, pz, inCar ? game.playerCar.heading : game.player.heading);
    } else if (wanted < 3) {
      police.clearRoadblocks();
    }
    // Flash the roadblock light bars too.
    for (const block of police.roadblocks) {
      const on = Math.floor(game.time * (6 + wanted)) % 2 === 0;
      for (const car of block.cars) {
        car.lightRed.material.color.setHex(on ? 0xff2222 : 0x551111);
        car.lightBlue.material.color.setHex(on ? 0x1133aa : 0x2266ff);
      }
    }
    // Despawn far cruisers once the heat is off.
    for (let i = police.cruisers.length - 1; i >= 0; i--) {
      const c = police.cruisers[i];
      if (wanted === 0 && distance2D(c.x, c.z, px, pz) > 120) {
        scene.remove(c.mesh);
        police.cruisers.splice(i, 1);
      }
    }

    // Chase: steer toward the player, ram on foot or in a car.
    for (const c of police.cruisers) {
      const dx = px - c.x, dz = pz - c.z;
      const d = Math.hypot(dx, dz) || 1;
      const targetHeading = Math.atan2(dx, dz);
      c.heading = lerpAngle(c.heading, targetHeading, Math.min(1, dt * 1.4));
      const chaseSpeed = Math.min(c.topSpeed, 22 + wanted * 4);
      c.speed += (chaseSpeed - c.speed) * dt;
      c.x += Math.sin(c.heading) * c.speed * dt;
      c.z += Math.cos(c.heading) * c.speed * dt;
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.heading;
      // Flash the light bar — faster as the heat rises.
      const on = Math.floor(game.time * (6 + wanted)) % 2 === 0;
      c.lightRed.material.color.setHex(on ? 0xff2222 : 0x551111);
      c.lightBlue.material.color.setHex(on ? 0x1133aa : 0x2266ff);
      // Ram damage.
      if (d < 3.2) {
        if (inCar) {
          game.playerCar.speed *= 0.55;
          game.player.damage(4 * dt * 10);
        } else if (d < 2.2) {
          police.bustTimer += dt;
          game.player.damage(6 * dt);
        }
      }
    }
    if (police.cruisers.every((c) => distance2D(c.x, c.z, px, pz) > 3)) {
      police.bustTimer = Math.max(0, police.bustTimer - dt * 2);
    }
    if (police.bustTimer >= BUST_TIMER && !inCar) {
      game.busted = true;
    }

    // Helicopters: heli 1 orbits at 3+ stars, heli 2 joins at 4+ — closer,
    // lower, counter-rotating, searchlights sweeping the player.
    for (const heli of police.helis) {
      if (wanted >= heli.minWanted) {
        heli.group.visible = true;
        heli.angle += dt * heli.orbitSpeed;
        const tx = px + Math.sin(heli.angle) * heli.orbitRadius;
        const tz = pz + Math.cos(heli.angle) * heli.orbitRadius;
        heli.x += (tx - heli.x) * Math.min(1, dt * 0.8);
        heli.z += (tz - heli.z) * Math.min(1, dt * 0.8);
        heli.group.position.set(heli.x, heli.y, heli.z);
        heli.group.rotation.y = Math.atan2(px - heli.x, pz - heli.z);
        heli.rotor.rotation.y += dt * 22;
        heli.tailRotor.rotation.x += dt * 30;
        const beaconOn = Math.floor(game.time * 3) % 2 === 0;
        heli.beacon.material.color.setHex(beaconOn ? 0xff2222 : 0x550000);
        // Searchlight cone stays under the belly, over the player.
        heli.lamp.material.opacity = 0.14 + 0.08 * Math.sin(game.time * 2 + heli.angle);
      } else {
        heli.group.visible = false;
      }
    }

    police.sirenOn = wanted >= 1 && police.cruisers.length > 0;
  };

  police.clearAll = function clearAllPolice() {
    for (const c of police.cruisers) scene.remove(c.mesh);
    police.cruisers.length = 0;
    police.clearRoadblocks();
    for (const heli of police.helis) heli.group.visible = false;
    police.bustTimer = 0;
    game.wanted = 0;
  };

  return police;
}
