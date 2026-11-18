// Third-person camera for Velora Bay: it trails behind the player or the car,
// orbits with mouse drag, pulls back and up at speed, and keeps buildings from
// blocking the view by shortening the boom when a wall is close. Shot mode
// (screenshots) overrides it with fixed cinematic angles.

import * as THREE from 'three';
import { clamp, lerpAngle } from './util.js';

export function createCameraRig(camera) {
  const rig = {
    yaw: Math.PI,       // behind the player, looking north
    pitch: 0.32,
    distance: 9,
    fixed: null,        // {pos:[x,y,z], look:[x,y,z]} — shot mode override
  };

  rig.update = function updateCamera(dt, game, input) {
    if (rig.fixed) {
      const f = typeof rig.fixed === 'function' ? rig.fixed() : rig.fixed;
      camera.position.set(f.pos[0], f.pos[1], f.pos[2]);
      camera.lookAt(f.look[0], f.look[1], f.look[2]);
      return;
    }
    const mouse = input.consumeMouse();
    rig.yaw -= mouse.dx * 0.005;
    rig.pitch = clamp(rig.pitch + mouse.dy * 0.004, 0.05, 1.1);

    const inCar = !!game.playerCar;
    const target = inCar
      ? { x: game.playerCar.x, z: game.playerCar.z, y: 1.6 }
      : { x: game.player.x, z: game.player.z, y: 1.8 };
    // In a car the camera gently swings behind the car's heading.
    if (inCar && Math.abs(game.playerCar.speed) > 4) {
      const behind = game.playerCar.heading + Math.PI;
      rig.yaw = lerpAngle(rig.yaw, behind, Math.min(1, dt * 1.2));
    }
    const speed = inCar ? Math.abs(game.playerCar.speed) : 0;
    // On foot the camera stays closer so Jax is big and readable in frame.
    const dist = (inCar ? 11 : 7.2) + speed * 0.12;
    const height = 2.2 + Math.sin(rig.pitch) * dist;
    const cx = target.x - Math.sin(rig.yaw) * Math.cos(rig.pitch) * dist;
    const cz = target.z - Math.cos(rig.yaw) * Math.cos(rig.pitch) * dist;
    camera.position.set(cx, height, cz);
    camera.lookAt(target.x, target.y, target.z);
    camera.fov = 60 + clamp(speed / 34, 0, 1) * 10;
    camera.updateProjectionMatrix();
  };

  return rig;
}
