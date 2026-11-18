// Shared helpers for VELORA BAY: deterministic random numbers, math and geometry.
// Every system in the game uses these so the city, traffic and missions are stable
// for a given seed (screenshots use seed 1).

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickRandom(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

export function rangeRandom(rng, min, max) {
  return min + rng() * (max - min);
}

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function lerpAngle(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export function distance2D(ax, az, bx, bz) {
  const dx = ax - bx, dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

// Push a circle (x, z, radius) out of every axis-aligned box collider it overlaps.
export function resolveCircleColliders(x, z, radius, colliders) {
  for (const c of colliders) {
    const cx = clamp(x, c.minX, c.maxX);
    const cz = clamp(z, c.minZ, c.maxZ);
    const dx = x - cx, dz = z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        x = cx + (dx / d) * radius;
        z = cz + (dz / d) * radius;
      } else {
        // Centre inside the box: push out along the smallest penetration axis.
        const pl = x - c.minX, pr = c.maxX - x, pt = z - c.minZ, pb = c.maxZ - z;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) x = c.minX - radius;
        else if (m === pr) x = c.maxX + radius;
        else if (m === pt) z = c.minZ - radius;
        else z = c.maxZ + radius;
      }
    }
  }
  return { x, z };
}

export function formatMoney(n) {
  return '$' + Math.floor(n).toLocaleString('en-US');
}
