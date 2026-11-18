// Combat for Velora Bay: fists and a pistol, rival gang members who fight back,
// hit feedback and the crime consequences of violence. Shooting uses a ray
// from the camera centre so aiming is exactly what the player sees.

import * as THREE from 'three';
import { clamp, distance2D, mulberry32, pickRandom, rangeRandom } from './util.js';
import { makePedestrianFigure } from './player.js';

export function createCombat(scene, city, seed, game) {
  const rng = mulberry32(seed + 31337);
  const combat = {
    enemies: [],
    tracers: [],
    raycaster: new THREE.Raycaster(),
    shootCooldown: 0,
    spawnTimer: 0,
  };

  // A short-lived glowing line for each gunshot, so firefights read on screen.
  function spawnTracer(from, to) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe066 }));
    scene.add(line);
    combat.tracers.push({ line, life: 0.12 });
  }

  combat.spawnEnemy = function spawnEnemy(x, z, opts = {}) {
    const fig = makePedestrianFigure(scene, opts.shirt ?? 0x7b2cbf, 0x222222);
    fig.group.position.set(x, 0, z);
    const enemy = {
      fig, x, z,
      health: opts.health ?? 60,
      speed: rangeRandom(rng, 3.2, 4.6),
      punchCooldown: 0,
      alive: true,
      isBoss: !!opts.isBoss,
    };
    fig.group.userData.enemyRef = enemy;
    if (enemy.isBoss) {
      fig.group.scale.setScalar(1.25);
      enemy.health = 220;
    }
    combat.enemies.push(enemy);
    return enemy;
  };

  // The player punches: short range, hurts the nearest enemy or pedestrian.
  combat.playerPunch = function playerPunch() {
    const px = game.player.x, pz = game.player.z;
    const range = 2.6;
    let hitSomething = false;
    for (const e of combat.enemies) {
      if (!e.alive) continue;
      if (distance2D(px, pz, e.x, e.z) < range) {
        combat.damageEnemy(e, 22);
        hitSomething = true;
      }
    }
    if (!hitSomething) {
      const ped = game.traffic.nearestPed(px, pz, range);
      if (ped) {
        ped.alive = false;
        ped.fig.group.visible = false;
        game.police.addWanted(1);
        game.hud.showMessage('You knocked out a pedestrian!');
        hitSomething = true;
      }
    }
    return hitSomething;
  };

  // The player shoots: raycast from the camera through the crosshair.
  combat.playerShoot = function playerShoot(camera) {
    if (combat.shootCooldown > 0) return false;
    if (game.player.ammo <= 0) {
      game.hud.showMessage('Out of ammo — visit Velora Arms!');
      game.audio.playBlip(160);
      combat.shootCooldown = 0.3;
      return false;
    }
    combat.shootCooldown = 0.28;
    game.player.ammo -= 1;
    game.audio.playShot();
    combat.raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const targets = [];
    for (const e of combat.enemies) {
      if (e.alive) targets.push(e.fig.group);
    }
    const hits = combat.raycaster.intersectObjects(targets, true);
    const origin = camera.position.clone();
    if (hits.length > 0) {
      const hitPoint = hits[0].point;
      spawnTracer(origin, hitPoint);
      let obj = hits[0].object;
      while (obj && !obj.userData.enemyRef) obj = obj.parent;
      if (obj) combat.damageEnemy(obj.userData.enemyRef, 34);
    } else {
      const far = origin.clone().add(combat.raycaster.ray.direction.clone().multiplyScalar(90));
      spawnTracer(origin, far);
    }
    game.police.addWanted(1);
    return true;
  };

  combat.damageEnemy = function damageEnemy(enemy, amount) {
    enemy.health -= amount;
    // Knockback flash: tilt the figure briefly.
    enemy.fig.group.rotation.x = -0.25;
    setTimeout(() => { if (enemy.fig) enemy.fig.group.rotation.x = 0; }, 120);
    if (enemy.health <= 0 && enemy.alive) {
      enemy.alive = false;
      enemy.fig.group.visible = false;
      game.money += enemy.isBoss ? 400 : 60;
      game.hud.showMessage(enemy.isBoss ? 'Reyes is down! +$400' : 'Rival down! +$60');
      game.audio.playBlip(880);
      if (game.missions) game.missions.onEnemyDown(enemy);
    }
  };

  combat.update = function updateCombat(dt) {
    if (combat.shootCooldown > 0) combat.shootCooldown -= dt;
    for (let i = combat.tracers.length - 1; i >= 0; i--) {
      const t = combat.tracers[i];
      t.life -= dt;
      if (t.life <= 0) {
        scene.remove(t.line);
        t.line.geometry.dispose();
        combat.tracers.splice(i, 1);
      }
    }
    // Enemies chase the player and punch when close.
    const px = game.player.x, pz = game.player.z;
    for (const e of combat.enemies) {
      if (!e.alive) continue;
      const d = distance2D(e.x, e.z, px, pz);
      if (d > 90) continue; // dormant far away
      if (d > 2.0) {
        const dx = px - e.x, dz = pz - e.z;
        const len = Math.hypot(dx, dz) || 1;
        e.x += (dx / len) * e.speed * dt;
        e.z += (dz / len) * e.speed * dt;
        e.fig.group.position.set(e.x, 0, e.z);
        e.fig.group.rotation.y = Math.atan2(dx, dz);
        const swing = Math.sin(game.time * 8) * 0.5;
        e.fig.legL.rotation.x = swing;
        e.fig.legR.rotation.x = -swing;
      } else if (e.punchCooldown <= 0) {
        e.punchCooldown = 1.1;
        game.player.damage(e.isBoss ? 16 : 9);
        game.audio.playPunch();
        game.hud.flashDamage();
      }
      if (e.punchCooldown > 0) e.punchCooldown -= dt;
    }
  };

  combat.clearEnemies = function clearEnemies() {
    for (const e of combat.enemies) scene.remove(e.fig.group);
    combat.enemies.length = 0;
  };

  combat.spawnRivalSquad = function spawnRivalSquad(x, z, count, boss) {
    const squad = [];
    for (let i = 0; i < count; i++) {
      squad.push(combat.spawnEnemy(
        x + rangeRandom(rng, -8, 8), z + rangeRandom(rng, -8, 8),
        { shirt: pickRandom(rng, [0x7b2cbf, 0x9d4edd, 0x5a189a]) }));
    }
    if (boss) squad.push(combat.spawnEnemy(x, z, { isBoss: true, shirt: 0xd62828 }));
    return squad;
  };

  return combat;
}
