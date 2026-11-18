// Save / load for Velora Bay: money, mission progress, health, ammo, owned
// cars and the player's position persist in localStorage under one key.
// Loading is forgiving — a corrupt or missing save just starts a new game.

export const SAVE_KEY = 'velora-bay-save-v1';

export function saveGame(game) {
  try {
    const data = {
      version: 1,
      money: game.money,
      missionIndex: game.missions ? game.missions.index : 0,
      health: game.player.health,
      ammo: game.player.ammo,
      weapon: game.player.weapon,
      x: game.player.x,
      z: game.player.z,
      heading: game.player.heading,
      ownedCars: game.ownedCars || [],
      savedAt: Date.now(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* storage unavailable */ }
}
