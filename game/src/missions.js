// The story of VELORA BAY: eight missions that take Jax Corvo from a reluctant
// wheelman back into the city's underworld and out again as its king. Each
// mission is data (title, briefing, type, target, reward) plus a small state
// machine in createMissions: a glowing beacon marks the objective, the HUD
// shows what to do, and completing one pays out and unlocks the next.

import * as THREE from 'three';
import { clamp, distance2D } from './util.js';

export const MISSIONS = [
  {
    id: 1, title: 'Homecoming', type: 'goto', reward: 150,
    briefing: "Marco Salas called you back to Velora Bay. Meet him at his garage on Coral Row.",
    objective: 'Meet Marco at his garage',
    target: 'garage',
  },
  {
    id: 2, title: 'First Job', type: 'drive', reward: 300,
    briefing: "Marco needs a fast car, no questions asked. Steal a sports car and bring it to the garage.",
    objective: 'Steal a sports car (E) and drive it to the garage',
    target: 'garage', needSports: true,
  },
  {
    id: 3, title: 'Beach Run', type: 'timed', reward: 400, timeLimit: 75,
    briefing: 'A package for the marina crew is burning a hole in your pocket. Get it to the pier — fast.',
    objective: 'Deliver the package to Marina Pier before time runs out',
    target: 'pier',
  },
  {
    id: 4, title: 'Heat', type: 'escape', reward: 350,
    briefing: 'The drop was spotted. VBPD is on you — lose the heat, then lay low.',
    objective: 'Lose your wanted level (stay out of sight)',
    target: null, startWanted: 2,
  },
  {
    id: 5, title: 'The Collection', type: 'collect', reward: 500,
    briefing: 'Three debtors owe Marco money: the plaza, the docks and the beach. Collect — fists if needed.',
    objective: 'Collect from 3 debtors (0/3)',
    targets: ['plaza', 'docks', 'beach'],
  },
  {
    id: 6, title: 'Ambush', type: 'fight', reward: 600, enemyCount: 5,
    briefing: "Reyes' crew jumped Marco's boys at Sol Plaza. Go and settle it.",
    objective: 'Defeat the rival crew at Sol Plaza (0/5)',
    target: 'plaza',
  },
  {
    id: 7, title: 'The Heist', type: 'timed', reward: 900, timeLimit: 120,
    briefing: 'The Marina Vault holds the Reyes ledger. Grab it and get out before the whole city wakes up.',
    objective: 'Reach the Marina Vault and grab the ledger',
    target: 'vault',
  },
  {
    id: 8, title: 'King of Velora', type: 'fight', reward: 1500, enemyCount: 6, boss: true,
    briefing: 'Reyes himself is waiting at his penthouse with his whole crew. End this. Take the city.',
    objective: 'Defeat Reyes and his crew at the penthouse',
    target: 'penthouse',
  },
];

export function createMissions(scene, city, game) {
  const missions = {
    index: 0,                 // 0-based into MISSIONS
    state: 'idle',            // idle | active | done
    timer: 0,
    collected: 0,
    defeated: 0,
    spawned: false,
    beacon: null,
    marker: null,
  };

  // Beacon: a tall glowing cylinder + a floating diamond over the objective.
  const beaconMat = new THREE.MeshBasicMaterial({
    color: 0xffd23e, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false,
  });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 60, 16, 1, true), beaconMat);
  beacon.visible = false;
  scene.add(beacon);
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.6),
    new THREE.MeshBasicMaterial({ color: 0xffd23e }));
  diamond.visible = false;
  scene.add(diamond);
  missions.beacon = beacon;
  missions.marker = diamond;

  function anchorPos(name) {
    const a = city.anchors[name];
    return a ? { x: a.x, z: a.z } : { x: 0, z: 0 };
  }

  missions.current = function currentMission() {
    return MISSIONS[missions.index] || null;
  };

  missions.isComplete = function isComplete() {
    return missions.index >= MISSIONS.length;
  };

  missions.startMission = function startMission(idx) {
    const m = MISSIONS[idx];
    if (!m) { missions.state = 'done'; return; }
    missions.index = idx;
    missions.state = 'active';
    missions.timer = m.timeLimit || 0;
    missions.collected = 0;
    missions.defeated = 0;
    missions.spawned = false;
    game.hud.showBanner('MISSION ' + m.id + ' — ' + m.title, m.briefing);
    game.hud.showMessage(m.objective);
    game.audio.playMissionStart();
    if (m.type === 'escape' && m.startWanted) game.police.addWanted(m.startWanted);
  };

  function completeMission() {
    const m = missions.current();
    game.money += m.reward;
    game.hud.showBanner('MISSION COMPLETE', m.title + ' — +$' + m.reward);
    game.audio.playMissionComplete();
    beacon.visible = false;
    diamond.visible = false;
    game.save();
    missions.index += 1;
    missions.state = 'idle';
    if (missions.isComplete()) {
      game.hud.showBanner('KING OF VELORA', 'You own the city now, Jax. The end — for now.');
      game.state = 'complete';
    } else {
      setTimeout(() => { if (game.state === 'playing') missions.startMission(missions.index); }, 2500);
    }
  }

  function failMission(reason) {
    game.hud.showBanner('MISSION FAILED', reason);
    game.audio.playBlip(110);
    missions.state = 'idle';
    setTimeout(() => { if (game.state === 'playing') missions.startMission(missions.index); }, 2500);
  }

  function currentTargets() {
    const m = missions.current();
    if (!m) return [];
    if (m.type === 'collect') return m.targets.slice(missions.collected);
    if (m.target) return [m.target];
    return [];
  }

  missions.onEnemyDown = function onEnemyDown(enemy) {
    const m = missions.current();
    if (!m || missions.state !== 'active') return;
    if (m.type !== 'fight') return;
    missions.defeated += 1;
    game.hud.showMessage(m.objective.replace(/\(\d+\/\d+\)/, `(${missions.defeated}/${m.enemyCount + (m.boss ? 1 : 0)})`));
    const total = m.enemyCount + (m.boss ? 1 : 0);
    if (missions.defeated >= total) completeMission();
  };

  missions.update = function updateMissions(dt) {
    const m = missions.current();
    if (!m || missions.state !== 'active') {
      beacon.visible = false;
      diamond.visible = false;
      return;
    }
    const px = game.player.x, pz = game.player.z;

    // Spawn fight squads once, at the mission site.
    if (m.type === 'fight' && !missions.spawned) {
      const site = anchorPos(m.target);
      game.combat.spawnRivalSquad(site.x, site.z, m.enemyCount, !!m.boss);
      missions.spawned = true;
      game.hud.showMessage('Rival crew incoming — take them down!');
    }

    // Timed missions count down.
    if (m.timeLimit) {
      missions.timer -= dt;
      game.hud.setTimer(Math.max(0, missions.timer));
      if (missions.timer <= 0) {
        failMission('Out of time — the window closed.');
        return;
      }
    }

    // Beacon follows the current objective.
    const targets = currentTargets();
    if (targets.length > 0) {
      const pos = anchorPos(targets[0]);
      beacon.position.set(pos.x, 30, pos.z);
      beacon.visible = true;
      diamond.position.set(pos.x, 14 + Math.sin(game.time * 2) * 0.8, pos.z);
      diamond.rotation.y += dt * 2;
      diamond.visible = true;
      const d = distance2D(px, pz, pos.x, pos.z);
      game.hud.setDistance(d);
      if (d < 7) {
        if (m.type === 'goto' || m.type === 'drive' || m.type === 'timed') {
          if (m.type === 'drive' && !(game.playerCar && game.playerCar.kind === 'sports')) {
            game.hud.showMessage('Marco wants a SPORTS car — find one!');
            return;
          }
          completeMission();
          return;
        }
        if (m.type === 'collect') {
          missions.collected += 1;
          game.money += 100;
          game.hud.showMessage(`Collected $100 (${missions.collected}/3)`);
          game.audio.playBlip(660);
          if (missions.collected >= m.targets.length) completeMission();
          return;
        }
      }
    } else {
      beacon.visible = false;
      diamond.visible = false;
    }

    // Escape: win when the wanted level cools to zero.
    if (m.type === 'escape' && game.wanted < 0.5) {
      completeMission();
    }
  };

  return missions;
}
