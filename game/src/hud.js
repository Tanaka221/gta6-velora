// The HUD for Velora Bay: wanted stars, health, money, mission objective,
// speedometer, radio readout, transient messages, banners and the shop menu.
// All DOM, updated from the game state every frame (cheap parts throttled).

import { formatMoney } from './util.js';

export function createHud(game) {
  const $ = (id) => document.getElementById(id);
  const els = {
    stars: $('stars'), objective: $('objective'), healthfill: $('healthfill'),
    healthText: $('healthText'), weaponText: $('weaponText'), ammoText: $('ammoText'),
    money: $('money'), speedText: $('speedText'), carText: $('carText'),
    radioTrack: $('radioTrack'), message: $('message'), prompt: $('prompt'),
    crosshair: $('crosshair'), banner: $('banner'),
    menu: $('menu'), pauseMenu: $('pauseMenu'), deadMenu: $('deadMenu'),
    bustedMenu: $('bustedMenu'), shopMenu: $('shopMenu'),
    shopTitle: $('shopTitle'), shopDesc: $('shopDesc'), shopButtons: $('shopButtons'),
  };

  const hud = {
    messageTimer: 0,
    bannerTimer: 0,
    damageFlash: 0,
    lastStars: -1,
  };

  hud.showMessage = function showMessage(text, seconds = 3.5) {
    els.message.textContent = text;
    els.message.style.opacity = '1';
    hud.messageTimer = seconds;
  };

  hud.showBanner = function showBanner(big, sub) {
    els.banner.querySelector('.big').textContent = big;
    els.banner.querySelector('.sub').textContent = sub || '';
    els.banner.style.display = 'block';
    hud.bannerTimer = 3.2;
  };

  hud.flashDamage = function flashDamage() {
    hud.damageFlash = 0.35;
  };

  hud.setTimer = function setTimer(seconds) {
    hud.timerText = '⏱ ' + Math.ceil(seconds) + 's';
  };

  hud.setDistance = function setDistance(d) {
    hud.distanceText = Math.round(d) + 'm';
  };

  hud.setPrompt = function setPrompt(text) {
    if (text) {
      els.prompt.textContent = text;
      els.prompt.style.display = 'block';
    } else {
      els.prompt.style.display = 'none';
    }
  };

  hud.openShopMenu = function openShopMenu(shop) {
    els.shopTitle.textContent = shop.name;
    els.shopDesc.textContent = shop.desc;
    els.shopButtons.innerHTML = '';
    for (const item of shop.items) {
      const btn = document.createElement('button');
      btn.textContent = item.label;
      btn.addEventListener('click', () => game.shops.buy(item));
      els.shopButtons.appendChild(btn);
    }
    els.shopMenu.style.display = 'flex';
  };

  hud.closeShopMenu = function closeShopMenu() {
    els.shopMenu.style.display = 'none';
  };

  hud.showScreen = function showScreen(name) {
    els.menu.style.display = name === 'menu' ? 'flex' : 'none';
    els.pauseMenu.style.display = name === 'pause' ? 'flex' : 'none';
    els.deadMenu.style.display = name === 'dead' ? 'flex' : 'none';
    els.bustedMenu.style.display = name === 'busted' ? 'flex' : 'none';
    if (name !== 'shop') els.shopMenu.style.display = 'none';
    // The HUD belongs to gameplay: hide it behind the title screen.
    const hudEls = document.querySelectorAll('#stars,#objective,#stats,#speedo,#minimap,#radio,#message,#prompt,#crosshair,#banner');
    for (const el of hudEls) el.style.visibility = name === 'menu' ? 'hidden' : 'visible';
  };

  hud.update = function updateHud(dt) {
    const p = game.player;
    // Wanted stars.
    const stars = Math.round(game.wanted);
    if (stars !== hud.lastStars) {
      hud.lastStars = stars;
      let html = '';
      for (let i = 0; i < 5; i++) {
        html += i < stars ? '★' : '<span class="off">★</span>';
      }
      els.stars.innerHTML = html;
    }
    // Health + money + weapon.
    els.healthfill.style.width = Math.max(0, p.health) + '%';
    els.healthfill.style.background = p.health > 50
      ? 'linear-gradient(90deg,#37d67a,#a5f2c1)'
      : p.health > 25 ? 'linear-gradient(90deg,#ffb703,#ffe066)' : 'linear-gradient(90deg,#ef476f,#ff8fa3)';
    els.healthText.textContent = Math.ceil(p.health);
    els.weaponText.textContent = p.weapon === 'pistol' ? 'PISTOL' : 'FISTS';
    els.ammoText.textContent = p.weapon === 'pistol' ? ('🔫 ' + p.ammo) : '';
    els.money.textContent = formatMoney(game.money);
    els.money.style.color = game.money < 0 ? '#ff8fa3' : '#7dff9b';
    // Speed + car name.
    const speedMph = game.playerCar ? Math.round(Math.abs(game.playerCar.speed) * 2.2) : 0;
    els.speedText.textContent = speedMph;
    els.carText.textContent = game.playerCar ? game.playerCar.name : '';
    // Objective line: mission text + timer / distance.
    const m = game.missions ? game.missions.current() : null;
    if (m && game.missions.state === 'active') {
      let extra = '';
      if (hud.timerText) extra += ' · ' + hud.timerText;
      if (hud.distanceText) extra += ' · ' + hud.distanceText;
      els.objective.innerHTML = '<b>MISSION ' + m.id + ' — ' + m.title + '</b><br>' + m.objective + extra;
    } else if (game.missions && game.missions.isComplete()) {
      els.objective.innerHTML = '<b>KING OF VELORA</b><br>You own the city. Free roam — cause chaos, or don’t.';
    } else {
      els.objective.innerHTML = '<b>VELORA BAY</b><br>Press E near a car to steal it. Follow the gold beacon for missions.';
    }
    hud.timerText = null;
    hud.distanceText = null;
    // Crosshair only when the pistol is out and the player is on foot.
    els.crosshair.style.display = (!game.playerCar && p.weapon === 'pistol' && game.state === 'playing') ? 'block' : 'none';
    // Message + banner fade.
    if (hud.messageTimer > 0) {
      hud.messageTimer -= dt;
      if (hud.messageTimer <= 0) els.message.style.opacity = '0';
    }
    if (hud.bannerTimer > 0) {
      hud.bannerTimer -= dt;
      if (hud.bannerTimer <= 0) els.banner.style.display = 'none';
    }
    if (hud.damageFlash > 0) {
      hud.damageFlash -= dt;
      document.body.style.boxShadow = 'inset 0 0 120px rgba(255,0,0,0.55)';
      if (hud.damageFlash <= 0) document.body.style.boxShadow = 'none';
    }
  };

  return hud;
}
