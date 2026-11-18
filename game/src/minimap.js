// The minimap: a circular 2D canvas that draws the road grid, the beach,
// the player arrow, traffic, police, the mission beacon and shop markers,
// rotated so the player's heading is always up.

import { districtName } from './world/city.js';

export function createMinimap(game) {
  const canvas = document.getElementById('minimap');
  const ctx = canvas.getContext('2d');
  const SIZE = 220;
  const SCALE = SIZE / 640; // city 600m + margin, mapped to the canvas

  function toMap(x, z, px, pz, heading) {
    // Rotate world coordinates so the player's heading points up.
    const dx = (x - px) * SCALE;
    const dz = (z - pz) * SCALE;
    const sin = Math.sin(heading), cos = Math.cos(heading);
    return {
      x: SIZE / 2 + dx * cos - dz * sin,
      y: SIZE / 2 + dx * sin + dz * cos,
    };
  }

  function drawMinimap() {
    const px = game.player.x, pz = game.player.z;
    const heading = game.playerCar ? game.playerCar.heading : game.player.heading;
    ctx.clearRect(0, 0, SIZE, SIZE);
    // Clip to the circle.
    ctx.save();
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2);
    ctx.clip();
    // Sea + sand + land.
    ctx.fillStyle = '#0e2a3d';
    ctx.fillRect(0, 0, SIZE, SIZE);
    const beach = toMap(280, 0, px, pz, heading);
    ctx.fillStyle = '#e8d29a';
    ctx.fillRect(beach.x - 20, -20, 60, SIZE + 40);
    // Roads.
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 3;
    for (const c of game.city.roadsX) {
      const a = toMap(c, -320, px, pz, heading);
      const b = toMap(c, 320, px, pz, heading);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      const a2 = toMap(-320, c, px, pz, heading);
      const b2 = toMap(320, c, px, pz, heading);
      ctx.beginPath(); ctx.moveTo(a2.x, a2.y); ctx.lineTo(b2.x, b2.y); ctx.stroke();
    }
    // Buildings as faint blocks.
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    for (const b of game.city.buildings) {
      const p = toMap(b.x, b.z, px, pz, heading);
      ctx.fillRect(p.x - b.w * SCALE / 2, p.y - b.d * SCALE / 2, b.w * SCALE, b.d * SCALE);
    }
    // Shops.
    if (game.shops) {
      for (const s of game.shops.list) {
        const p = toMap(s.x, s.z, px, pz, heading);
        ctx.fillStyle = '#7dff5e';
        ctx.beginPath(); ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2); ctx.fill();
      }
    }
    // Mission beacon.
    const m = game.missions && game.missions.current();
    if (m && game.missions.state === 'active') {
      const targets = m.type === 'collect'
        ? m.targets.slice(game.missions.collected)
        : (m.target ? [m.target] : []);
      for (const t of targets) {
        const a = game.city.anchors[t];
        if (!a) continue;
        const p = toMap(a.x, a.z, px, pz, heading);
        ctx.fillStyle = '#ffd23e';
        ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
    // Traffic (white), police (red/blue flashing).
    if (game.traffic) {
      ctx.fillStyle = '#ffffff';
      for (const c of game.traffic.cars) {
        const p = toMap(c.x, c.z, px, pz, heading);
        ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
      }
      if (game.playerCar) {
        const p = toMap(game.playerCar.x, game.playerCar.z, px, pz, heading);
        ctx.fillStyle = '#7de3ff';
        ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
      }
    }
    if (game.police) {
      const flash = Math.floor(game.time * 4) % 2 === 0;
      ctx.fillStyle = flash ? '#ff3333' : '#3388ff';
      for (const c of game.police.cruisers) {
        const p = toMap(c.x, c.z, px, pz, heading);
        ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill();
      }
      if (game.police.heli.group.visible) {
        const p = toMap(game.police.heli.x, game.police.heli.z, px, pz, heading);
        ctx.fillStyle = '#ff3333';
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText('H', p.x - 4, p.y + 5);
      }
    }
    // Player arrow (always centre, pointing up).
    ctx.fillStyle = '#ffd23e';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(SIZE / 2, SIZE / 2 - 9);
    ctx.lineTo(SIZE / 2 + 6, SIZE / 2 + 7);
    ctx.lineTo(SIZE / 2 - 6, SIZE / 2 + 7);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
    // Compass ring + district label.
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', SIZE / 2, 14);
    ctx.fillText(districtName(px, pz), SIZE / 2, SIZE - 8);
  }

  return { draw: drawMinimap };
}
