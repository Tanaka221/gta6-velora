// Shops and the garage: Velora Arms sells pistol ammo, Taco Sol sells health,
// and Marco's Garage stores the cars you own. Walk into a glowing ring and
// press E — the shop menu is plain DOM so it works with mouse or keyboard.

import * as THREE from 'three';
import { distance2D } from './util.js';

export function createShops(scene, city, game) {
  const shops = { list: [], open: null };

  function ring(x, z, color) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2.6, 3.4, 32),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.15, z);
    scene.add(ring);
    return ring;
  }

  const defs = [
    {
      key: 'gunShop', name: 'Velora Arms', color: 0xff2e88,
      desc: 'Ammo, armour and attitude. Cash only, no questions.',
      items: [
        { label: 'Pistol ammo ×24 — $50', price: 50, apply: () => { game.player.ammo += 24; } },
        { label: 'Full health — $40', price: 40, apply: () => { game.player.heal(100); } },
        { label: 'Pistol (if lost) — $200', price: 200, apply: () => { game.player.setWeapon('pistol'); game.player.ammo += 12; } },
      ],
    },
    {
      key: 'foodShop', name: 'Taco Sol', color: 0x7dff5e,
      desc: 'The best tacos on Coral Row. Jax swears by the al pastor.',
      items: [
        { label: 'Taco combo — heal 50 — $25', price: 25, apply: () => { game.player.heal(50); } },
        { label: 'Feast — full health — $45', price: 45, apply: () => { game.player.heal(100); } },
      ],
    },
    {
      key: 'garage', name: "Marco's Garage", color: 0xffd23e,
      desc: 'Marco stores your rides here. Park a car in the ring and it is yours.',
      items: [
        { label: 'Store current car — free', price: 0, apply: () => {
          if (game.playerCar) {
            game.ownedCars.push({ name: game.playerCar.name, color: game.playerCar.color, kind: game.playerCar.kind });
            game.hud.showMessage(game.playerCar.name + ' stored in the garage.');
          } else game.hud.showMessage('Drive a car in first!');
        } },
        { label: 'Repair current car — $30', price: 30, apply: () => {
          if (game.playerCar) { game.playerCar.speed = 0; game.hud.showMessage('Car repaired.'); }
          else game.hud.showMessage('No car to repair!');
        } },
      ],
    },
  ];

  for (const def of defs) {
    const a = city.anchors[def.key];
    const mesh = ring(a.x, a.z, def.color);
    shops.list.push({ ...def, x: a.x, z: a.z, mesh });
  }

  shops.nearestInRange = function nearestInRange(x, z) {
    for (const s of shops.list) {
      if (distance2D(x, z, s.x, s.z) < 4.5) return s;
    }
    return null;
  };

  shops.openShop = function openShop(shop) {
    shops.open = shop;
    game.state = 'shopping';
    game.hud.openShopMenu(shop);
    game.audio.playBlip(520);
  };

  shops.closeShop = function closeShop() {
    shops.open = null;
    game.state = 'playing';
    game.hud.closeShopMenu();
  };

  shops.buy = function buy(item) {
    if (game.money < item.price) {
      game.hud.showMessage('Not enough cash!');
      game.audio.playBlip(140);
      return;
    }
    game.money -= item.price;
    item.apply();
    game.audio.playBlip(780);
    game.hud.showMessage('Bought: ' + item.label);
    game.save();
  };

  shops.update = function updateShops(dt, t) {
    for (const s of shops.list) {
      const m = s.mesh.material;
      m.opacity = 0.5 + Math.sin(t * 3) * 0.25;
    }
  };

  return shops;
}
