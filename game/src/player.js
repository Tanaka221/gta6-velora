// Jax Corvo on foot: a simple articulated figure (torso, head, limbs) that walks,
// sprints, punches and enters cars. Movement is camera-relative, the figure turns
// toward its travel direction, and building colliders keep him on the streets.

import * as THREE from 'three';
import { clamp, resolveCircleColliders } from './util.js';

const WALK_SPEED = 6;
const SPRINT_SPEED = 10.5;

export function createPlayer(scene, start) {
  const group = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xd9a066 });
  // Jax's signature look: bright red-orange jacket, white tee, dark jeans,
  // white sneakers and a navy cap — readable from a distance in any shot.
  const jacket = new THREE.MeshLambertMaterial({ color: 0xe63b2e });
  const tee = new THREE.MeshLambertMaterial({ color: 0xf5f0e6 });
  const jeans = new THREE.MeshLambertMaterial({ color: 0x2b4a6f });
  const capMat = new THREE.MeshLambertMaterial({ color: 0x1d3557 });
  const shoeMat = new THREE.MeshLambertMaterial({ color: 0xf5f5f5 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.1, 0.55), jacket);
  torso.position.y = 1.35; torso.castShadow = true;
  group.add(torso);
  // White tee showing down the open jacket front.
  const teeFront = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.0, 0.08), tee);
  teeFront.position.set(0, 1.35, 0.28);
  group.add(teeFront);
  // Open collar flaps.
  for (const cx of [-0.3, 0.3]) {
    const flap = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.28, 0.08), jacket);
    flap.position.set(cx, 1.82, 0.28);
    flap.rotation.x = -0.35;
    group.add(flap);
  }
  // Belt at the waist.
  const belt = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.14, 0.57),
    new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
  belt.position.y = 0.82;
  group.add(belt);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), skin);
  head.position.y = 2.2; head.castShadow = true;
  group.add(head);
  // Navy cap with a brim, worn forwards.
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.6), capMat);
  cap.position.y = 2.52;
  group.add(cap);
  const brim = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.06, 0.3), capMat);
  brim.position.set(0, 2.44, 0.4);
  group.add(brim);
  // Jacket arms with skin hands at the ends.
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.0, 0.3), jacket);
  armL.position.set(-0.66, 1.35, 0);
  group.add(armL);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.0, 0.3), jacket);
  armR.position.set(0.66, 1.35, 0);
  group.add(armR);
  for (const arm of [armL, armR]) {
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.24, 0.26), skin);
    hand.position.y = -0.58;
    arm.add(hand);
  }
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.9, 0.36), jeans);
  legL.position.set(-0.26, 0.45, 0);
  group.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.9, 0.36), jeans);
  legR.position.set(0.26, 0.45, 0);
  group.add(legR);
  // White sneakers on the ends of the legs.
  for (const leg of [legL, legR]) {
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.16, 0.62), shoeMat);
    shoe.position.set(0, -0.48, 0.1);
    leg.add(shoe);
  }

  // Pistol held in the right hand, shown only when the pistol is equipped.
  const gun = new THREE.Group();
  const gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.5),
    new THREE.MeshLambertMaterial({ color: 0x222222 }));
  gun.add(gunBody);
  gun.position.set(0.62, 1.0, 0.25);
  gun.visible = false;
  group.add(gun);

  group.position.set(start.x, 0, start.z);
  group.rotation.y = start.heading || 0;
  scene.add(group);

  const player = {
    group, armL, armR, legL, legR, gun, torso, head,
    x: start.x, z: start.z, heading: start.heading || 0,
    health: 100, maxHealth: 100,
    speed: 0, moving: false,
    punchTimer: 0, punchCooldown: 0,
    weapon: 'fists', ammo: 24,
    inCar: null,
    walkPhase: 0,
  };

  player.setWeapon = function setWeapon(name) {
    player.weapon = name;
    gun.visible = name === 'pistol';
  };

  player.punch = function punch() {
    if (player.punchCooldown > 0) return false;
    player.punchCooldown = 0.45;
    player.punchTimer = 0.28;
    return true;
  };

  player.damage = function damage(amount) {
    player.health = clamp(player.health - amount, 0, player.maxHealth);
    return player.health <= 0;
  };

  player.heal = function heal(amount) {
    player.health = clamp(player.health + amount, 0, player.maxHealth);
  };

  player.updateOnFoot = function updateOnFoot(dt, input, cameraYaw, colliders, game) {
    let mx = 0, mz = 0;
    if (input.pressed('up')) mz -= 1;
    if (input.pressed('down')) mz += 1;
    if (input.pressed('left')) mx -= 1;
    if (input.pressed('right')) mx += 1;
    const sprint = input.pressed('sprint');
    player.moving = mx !== 0 || mz !== 0;
    if (player.moving) {
      const len = Math.hypot(mx, mz);
      mx /= len; mz /= len;
      // Camera-relative movement: forward is away from the camera.
      const sin = Math.sin(cameraYaw), cos = Math.cos(cameraYaw);
      const wx = mx * cos - mz * sin;
      const wz = mx * sin + mz * cos;
      const speed = sprint ? SPRINT_SPEED : WALK_SPEED;
      let nx = player.x + wx * speed * dt;
      let nz = player.z + wz * speed * dt;
      const fixed = resolveCircleColliders(nx, nz, 0.7, colliders);
      nx = fixed.x; nz = fixed.z;
      nx = clamp(nx, -295, 295); nz = clamp(nz, -295, 295);
      player.x = nx; player.z = nz;
      player.speed = speed;
      const targetHeading = Math.atan2(wx, wz);
      let d = targetHeading - player.heading;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      player.heading += d * Math.min(1, dt * 12);
      player.walkPhase += dt * speed * 1.6;
    } else {
      player.speed = 0;
    }

    if (player.punchCooldown > 0) player.punchCooldown -= dt;
    if (player.punchTimer > 0) player.punchTimer -= dt;

    // Walk-cycle swing, punch extension on the right arm, and a forward
    // lean when sprinting so the run reads clearly from behind.
    const swing = player.moving ? Math.sin(player.walkPhase) * 0.6 : 0;
    const sprinting = player.moving && input.pressed('sprint');
    player.legL.rotation.x = swing * (sprinting ? 1.25 : 1);
    player.legR.rotation.x = -swing * (sprinting ? 1.25 : 1);
    player.armL.rotation.x = -swing * (sprinting ? 1.25 : 1);
    // Whole-figure forward lean while sprinting (torso, tee and collar move
    // together because they are all children of the group).
    group.rotation.x = sprinting ? 0.08 : 0;
    if (player.punchTimer > 0) {
      player.armR.rotation.x = -1.5;
    } else if (player.weapon === 'pistol') {
      player.armR.rotation.x = -1.2; // aim forward
    } else {
      player.armR.rotation.x = swing;
    }

    group.position.set(player.x, 0, player.z);
    group.rotation.y = player.heading;
    void game;
  };

  return player;
}

// A generic pedestrian figure (reused by traffic.js): same build, different colours.
export function makePedestrianFigure(scene, shirtColor, pantsColor) {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98d5f });
  const shirt = new THREE.MeshLambertMaterial({ color: shirtColor });
  const pants = new THREE.MeshLambertMaterial({ color: pantsColor });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.05, 0.45), shirt);
  torso.position.y = 1.3; torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), skin);
  head.position.y = 2.12;
  g.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.85, 0.32), pants);
  legL.position.set(-0.22, 0.42, 0);
  g.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.22;
  g.add(legR);
  scene.add(g);
  return { group: g, legL, legR };
}
