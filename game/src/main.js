// VELORA BAY — main entry point. Builds the world, wires every system together
// and runs the game loop. A single `game` object is shared by all modules:
// state, money, wanted level, the player, the car, and every subsystem.

import * as THREE from 'three';
import { buildCity } from './world/city.js';
import { createSky } from './world/sky.js';
import { createInput } from './input.js';
import { createPlayer } from './player.js';
import { createTraffic, driveCar } from './vehicles/traffic.js';
import { createPolice } from './police.js';
import { createCombat } from './combat.js';
import { createMissions } from './missions.js';
import { createShops } from './shops.js';
import { createHud } from './hud.js';
import { createMinimap } from './minimap.js';
import { createAudio } from './audio.js';
import { saveGame, loadGame } from './save.js';
import { createCameraRig } from './camera.js';
import { applyShot } from './shots.js';
import { distance2D, clamp } from './util.js';

const params = new URLSearchParams(window.location.search);
const SEED = Number(params.get('seed') || 1) || 1;
const SHOT = params.get('shot') || '';

const game = {
  time: 0,
  state: 'menu',           // menu | playing | paused | shopping | dead | busted | complete
  money: 250,
  wanted: 0,
  lastCrimeTime: -100,
  playerCar: null,
  ownedCars: [],
  busted: false,
  seed: SEED,
};

window.__veloraGame = game; // for play-testing and debugging

// --- Renderer / scene -------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.domElement.classList.add('webgl');
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(120, 60, 240);

game.scene = scene;
game.camera = camera;
game.renderer = renderer;

// --- World ------------------------------------------------------------------
game.sky = createSky(scene, SEED);
game.city = buildCity(scene, SEED);
game.input = createInput();
game.audio = createAudio();
game.player = createPlayer(scene, game.city.anchors.spawn);
game.traffic = createTraffic(scene, game.city, SEED);
game.police = createPolice(scene, game.city, SEED, game);
game.combat = createCombat(scene, game.city, SEED, game);
game.missions = createMissions(scene, game.city, game);
game.shops = createShops(scene, game.city, game);
game.hud = createHud(game);
game.minimap = createMinimap(game);
game.cameraRig = createCameraRig(camera);
game.save = () => saveGame(game);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Cars: enter / exit ------------------------------------------------------
game.enterCar = function enterCar(car) {
  car.driver = 'player';
  game.playerCar = car;
  game.player.inCar = car;
  game.player.group.visible = false;
  if (!car.stolen && !car.isPolice) {
    car.stolen = true;
    game.police.addWanted(1);
    game.hud.showMessage('You stole a ' + car.name + '! The law noticed.');
    game.audio.playBlip(220);
  }
};

game.exitCar = function exitCar() {
  const car = game.playerCar;
  if (!car) return;
  car.driver = null;
  car.speed = 0;
  game.playerCar = null;
  game.player.inCar = null;
  game.player.group.visible = true;
  const side = 2.6;
  game.player.x = car.x + Math.cos(car.heading) * side;
  game.player.z = car.z - Math.sin(car.heading) * side;
  game.player.heading = car.heading;
  game.player.group.position.set(game.player.x, 0, game.player.z);
};

function tryEnterCar() {
  const car = game.traffic.nearestParkedCar(game.player.x, game.player.z, 5);
  if (car) {
    game.enterCar(car);
    return true;
  }
  // Also allow taking over a slow traffic car next to the player.
  for (const c of game.traffic.cars) {
    if (distance2D(game.player.x, game.player.z, c.x, c.z) < 4 && Math.abs(c.speed) < 3) {
      game.enterCar(c);
      game.traffic.cars.splice(game.traffic.cars.indexOf(c), 1);
      return true;
    }
  }
  return false;
}

// --- Flow: start / pause / death -------------------------------------------
function startGame() {
  game.audio.ensure();
  const save = loadGame();
  if (save) {
    game.money = save.money ?? 250;
    game.player.health = save.health ?? 100;
    game.player.ammo = save.ammo ?? 24;
    game.player.setWeapon(save.weapon === 'pistol' ? 'pistol' : 'fists');
    game.player.x = save.x ?? game.city.anchors.spawn.x;
    game.player.z = save.z ?? game.city.anchors.spawn.z;
    game.ownedCars = save.ownedCars || [];
    game.missions.index = save.missionIndex ?? 0;
    game.hud.showMessage('Welcome back to Velora Bay, Jax.');
  }
  game.hud.showScreen('none');
  game.state = 'playing';
  game.missions.startMission(game.missions.index);
}

function pauseGame() {
  if (game.state !== 'playing') return;
  game.state = 'paused';
  game.hud.showScreen('pause');
  game.audio.update(0, game);
}

function resumeGame() {
  game.state = 'playing';
  game.hud.showScreen('none');
}

function handleDeath() {
  game.state = 'dead';
  game.hud.showScreen('dead');
  game.police.clearAll();
}

function handleBusted() {
  game.state = 'busted';
  game.busted = false;
  game.hud.showScreen('busted');
  game.police.clearAll();
}

// --- Buttons ----------------------------------------------------------------
document.getElementById('playBtn').addEventListener('click', startGame);
document.getElementById('resumeBtn').addEventListener('click', resumeGame);
document.getElementById('saveBtn').addEventListener('click', () => {
  if (game.save()) game.hud.showMessage('Game saved.');
  else game.hud.showMessage('Could not save (storage blocked).');
});
document.getElementById('respawnBtn').addEventListener('click', () => {
  game.money = Math.max(0, game.money - 100);
  game.player.health = 100;
  const h = game.city.anchors.hospital;
  game.player.x = h.x; game.player.z = h.z;
  game.player.group.position.set(h.x, 0, h.z);
  if (game.playerCar) { game.playerCar.driver = null; game.playerCar = null; game.player.inCar = null; }
  game.player.group.visible = true;
  game.wanted = 0;
  game.hud.showScreen('none');
  game.state = 'playing';
  game.hud.showMessage('You wake up at Velora General. -$100.');
});
document.getElementById('releaseBtn').addEventListener('click', () => {
  game.money = Math.max(0, game.money - 150);
  game.player.health = 100;
  const h = game.city.anchors.hospital;
  game.player.x = h.x; game.player.z = h.z;
  game.player.group.position.set(h.x, 0, h.z);
  game.wanted = 0;
  game.hud.showScreen('none');
  game.state = 'playing';
  game.hud.showMessage('Bail paid. Stay out of trouble, Jax. -$150.');
});
document.getElementById('shopClose').addEventListener('click', () => game.shops.closeShop());

// --- Input edges (one-shot keys) --------------------------------------------
const prevKeys = new Set();
function edge(action) {
  const now = game.input.pressed(action);
  const was = prevKeys.has(action);
  return now && !was;
}
function syncPrevKeys() {
  prevKeys.clear();
  for (const k of game.input.keys) prevKeys.add(k);
}

// --- Shot staging ------------------------------------------------------------
if (SHOT) {
  applyShot(game, SHOT);
  document.getElementById('loading').style.display = 'none';
}

// --- Main loop ---------------------------------------------------------------
const clock = new THREE.Clock();
let minimapTimer = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  game.time += dt;
  const input = game.input;

  if (game.state === 'menu') {
    // Slow cinematic orbit behind the title screen.
    const t = game.time * 0.04;
    camera.position.set(Math.sin(t) * 180, 55, Math.cos(t) * 180 + 40);
    camera.lookAt(0, 15, 0);
    game.sky.update(dt, game.time);
    game.traffic.update(dt, game);
    renderer.render(scene, camera);
    syncPrevKeys();
    return;
  }

  if (game.state === 'paused' || game.state === 'dead' || game.state === 'busted' || game.state === 'shopping') {
    if (edge('pause') && game.state === 'paused') resumeGame();
    if (edge('interact') && game.state === 'shopping') game.shops.closeShop();
    renderer.render(scene, camera);
    syncPrevKeys();
    return;
  }

  if (game.state !== 'playing' && game.state !== 'complete') {
    renderer.render(scene, camera);
    syncPrevKeys();
    return;
  }

  // --- Playing ---
  if (edge('pause')) { pauseGame(); syncPrevKeys(); return; }
  if (edge('radio')) {
    const name = game.audio.nextStation();
    document.getElementById('radioTrack').textContent = name;
    game.hud.showMessage('📻 ' + name);
  }
  if (edge('mute')) {
    game.audio.setMuted(!game.audio.muted);
    game.hud.showMessage(game.audio.muted ? 'Sound muted (M to unmute)' : 'Sound on');
  }
  if (edge('weapon1')) { game.player.setWeapon('fists'); game.hud.showMessage('Fists'); }
  if (edge('weapon2')) { game.player.setWeapon('pistol'); game.hud.showMessage('Pistol — ' + game.player.ammo + ' rounds'); }

  // Enter / exit car, or open a shop.
  if (edge('interact')) {
    if (game.playerCar) {
      game.exitCar();
    } else {
      const shop = game.shops.nearestInRange(game.player.x, game.player.z);
      if (shop) game.shops.openShop(shop);
      else tryEnterCar();
    }
  }

  // Combat input.
  const clicked = input.consumeClick();
  if (clicked || input.pressed('melee')) {
    if (game.playerCar) {
      // Honk: a little horn blip while driving.
      game.audio.playBlip(330);
    } else if (game.player.weapon === 'pistol') {
      game.combat.playerShoot(camera);
    } else if (game.player.punch()) {
      game.combat.playerPunch();
      game.audio.playPunch();
    }
  }

  // Movement: on foot or driving.
  if (game.playerCar) {
    driveCar(game.playerCar, input, dt, game.city.colliders);
    // Running over pedestrians is a crime the police notice.
    const ped = game.traffic.nearestPed(game.playerCar.x, game.playerCar.z, 2.6);
    if (ped && Math.abs(game.playerCar.speed) > 4) {
      ped.alive = false;
      ped.fig.group.visible = false;
      game.police.addWanted(1);
      game.hud.showMessage('You ran someone over!');
    }
    game.player.x = game.playerCar.x;
    game.player.z = game.playerCar.z;
  } else {
    game.player.updateOnFoot(dt, input, game.cameraRig.yaw, game.city.colliders, game);
  }

  // Prompt: what E does right here.
  if (!game.playerCar) {
    const shop = game.shops.nearestInRange(game.player.x, game.player.z);
    const car = shop ? null : game.traffic.nearestParkedCar(game.player.x, game.player.z, 5);
    if (shop) game.hud.setPrompt('Press E — ' + shop.name);
    else if (car) game.hud.setPrompt('Press E — steal the ' + car.name);
    else game.hud.setPrompt(null);
  } else {
    game.hud.setPrompt('Press E — exit car');
  }

  // Systems.
  game.traffic.update(dt, game);
  game.police.update(dt);
  game.combat.update(dt);
  game.missions.update(dt);
  game.shops.update(dt, game.time);
  game.sky.update(dt, game.time);
  game.audio.update(dt, game);
  game.cameraRig.update(dt, game, input);

  // Health regen (slow) and death / busted.
  if (game.player.health < game.player.maxHealth) {
    game.player.heal(dt * 1.2);
  }
  if (game.player.health <= 0) { handleDeath(); syncPrevKeys(); return; }
  if (game.busted) { handleBusted(); syncPrevKeys(); return; }

  // HUD + minimap.
  game.hud.update(dt);
  minimapTimer -= dt;
  if (minimapTimer <= 0) {
    minimapTimer = 0.08;
    game.minimap.draw();
  }
  document.getElementById('radioTrack').textContent = game.audio.stationName();

  renderer.render(scene, camera);
  syncPrevKeys();
}

// First frame, then hide the loading veil.
renderer.render(scene, camera);
document.getElementById('loading').style.display = 'none';
animate();
