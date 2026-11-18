// Deterministic screenshot staging for VELORA BAY: ?shot=start|drive|chase|mission
// puts the game into a real gameplay state — no fake backdrops, no composited
// images — so every screenshot is an honest render of the running game.
// The starter's shots.json pattern: each shot is a URL query the game reads.

import { createCar } from './vehicles/traffic.js';

// Keep traffic off the player's road so the shot stays clean.
function clearPlayerRoad(game) {
  for (const c of game.traffic.cars) {
    if (c.horizontal) c.z = -60;      // cross streets behind the player
    else c.x = 120;                   // parallel avenues, never x = 0
    c.mesh.position.set(c.x, 0, c.z);
  }
}

// A cinematic camera that travels with a car: rear three-quarter view.
function followCam(game, car, behind, side, up) {
  return () => {
    const h = car.heading;
    const px = car.x - Math.sin(h) * behind + Math.cos(h) * side;
    const pz = car.z - Math.cos(h) * behind - Math.sin(h) * side;
    return {
      pos: [px, up, pz],
      look: [car.x + Math.sin(h) * 8, 2, car.z + Math.cos(h) * 8],
    };
  };
}

// A camera ahead of a car looking back at it — the pursuers stay in frame.
function frontCam(game, car, ahead, side, up) {
  return () => {
    const h = car.heading;
    const px = car.x + Math.sin(h) * ahead + Math.cos(h) * side;
    const pz = car.z + Math.cos(h) * ahead - Math.sin(h) * side;
    return {
      pos: [px, up, pz],
      look: [car.x - Math.sin(h) * 6, 2, car.z - Math.cos(h) * 6],
    };
  };
}

export function applyShot(game, shotName) {
  const rig = game.cameraRig;
  const hud = game.hud;

  // Every gameplay shot starts the game for real (menu hidden, HUD live).
  function startPlaying() {
    hud.showScreen('none');
    game.state = 'playing';
    game.audio.ensure();
  }

  if (shotName === 'start') {
    // Title screen over a wide cinematic of downtown and the beach.
    game.state = 'menu';
    hud.showScreen('menu');
    rig.fixed = { pos: [150, 70, 300], look: [-40, 18, -40] };
    return;
  }

  if (shotName === 'drive') {
    startPlaying();
    // Jax in the Marlin GT supercar, cruising the avenue with traffic, mission 2 live.
    const car = createCar(game.scene, 0, 90, 0, { kind: 'supercar', color: 0xd62828, name: 'Marlin GT' });
    car.driver = 'player';
    game.enterCar(car);
    car.speed = 19;
    game.input.keys.add('up'); // hold the throttle so the shot shows driving
    clearPlayerRoad(game);
    game.missions.startMission(1); // First Job: bring the sports car to the garage
    rig.fixed = followCam(game, car, 15, 9, 6.5);
    return;
  }

  if (shotName === 'chase') {
    startPlaying();
    // Four-star wanted: a pack of interceptors converging, a roadblock behind
    // the car, TWO helicopters overhead with searchlights, mission live.
    const car = createCar(game.scene, 0, 40, 0, { kind: 'supercar', color: 0xd62828, name: 'Marlin GT' });
    car.driver = 'player';
    game.enterCar(car);
    // Rolling slowly (no throttle) so the car stays in frame with the pack,
    // the roadblock and the helicopters instead of driving away from them.
    car.speed = 10;
    clearPlayerRoad(game);
    game.wanted = 4;
    game.lastCrimeTime = game.time;
    // The car faces +z (heading 0), so the chase must be staged AHEAD of it
    // (+z, in the rear chase-cam's view): stageChase with heading PI spawns
    // the pack south of the player, and the cruisers are then lined up on
    // the avenue itself so the low camera sees them, not the buildings.
    game.police.stageChase(0, 40, 6, Math.PI, 0.55);
    const slots = [[-6, 50], [-2, 54], [2, 48], [6, 55], [-4, 58], [0, 62]];
    game.police.cruisers.forEach((c, i) => {
      const s = slots[i % slots.length];
      c.x = s[0]; c.z = s[1]; c.heading = Math.PI;
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.heading;
      // Hold the pack in place for the photo: live chasing rams the player
      // car and one cruiser ends up parked in front of the camera, hiding
      // the Marlin GT. (Real play is untouched — this is shot staging only.)
      c.topSpeed = 0; c.speed = 0;
    });
    game.police.spawnTimer = 1e9; // no fresh cruisers driving into the frame
    // Roadblock ahead of the car (+z), at the far end of the avenue in view.
    game.police.stageRoadblock(0, 40, 0);
    // Pull both helicopters low and into the frame for the shot — ahead of
    // the car (+z) so they sit in the chase-cam's view, searchlights over it.
    const heli1 = game.police.helis[0];
    const heli2 = game.police.helis[1];
    heli1.y = 8.5; heli1.x = 10; heli1.z = 52;
    heli2.y = 8; heli2.x = -9; heli2.z = 56;
    game.missions.startMission(1);
    game.hud.showMessage('VBPD on your tail — lose them!');
    // Low rear three-quarter chase cam, close behind the Marlin GT: the
    // supercar fills the lower frame (spoiler, taillight bar, rims readable)
    // while the converging interceptors, roadblock and both helicopters with
    // their searchlights stay ahead of it in the same frame.
    game.camera.fov = 60;
    game.camera.updateProjectionMatrix();
    rig.fixed = followCam(game, car, 6.5, 3.5, 3.2);
    return;
  }

  if (shotName === 'mission') {
    startPlaying();
    // Mission 6, Ambush: Jax on foot at Sol Plaza, pistol out, rivals closing in.
    game.player.x = 24; game.player.z = 24;
    // Face the camera so Jax's front — jacket, white tee, cap — is what shows.
    game.player.heading = Math.PI * 0.25;
    game.player.group.position.set(24, 0, 24);
    game.player.group.rotation.y = game.player.heading;
    game.player.setWeapon('pistol');
    game.player.ammo = 60;
    game.missions.startMission(5); // Ambush at Sol Plaza
    // Rivals between Jax and the plaza beam, inside the camera's view.
    game.combat.spawnRivalSquad(12, 12, 5, false);
    game.missions.spawned = true;
    // Close camera on Jax: he fills the frame, pistol out, rivals and the
    // objective beam still visible across the plaza behind him.
    rig.fixed = { pos: [31, 4.5, 31], look: [18, 2, 18] };
    return;
  }

  // Unknown shot: just play normally.
  startPlaying();
}
