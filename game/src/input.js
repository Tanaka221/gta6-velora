// Keyboard + mouse input for Velora Bay. WASD moves and drives, the mouse orbits
// the camera while dragged, clicks punch or shoot, and keys switch weapons,
// radio stations and pause. Shot mode never needs input.

export function createInput() {
  const input = {
    keys: new Set(),
    mouseDX: 0,
    mouseDY: 0,
    clicked: false,        // set true on a mouse-down, consumed by the game loop
    dragging: false,
    enabled: true,
  };

  const KEYMAP = {
    KeyW: 'up', ArrowUp: 'up',
    KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
    ShiftLeft: 'sprint', ShiftRight: 'sprint',
    Space: 'jump',
    KeyE: 'interact',
    KeyF: 'melee',
    Digit1: 'weapon1',
    Digit2: 'weapon2',
    KeyQ: 'radio',
    KeyM: 'mute',
    KeyP: 'pause',
    Escape: 'pause',
  };

  window.addEventListener('keydown', (e) => {
    if (!input.enabled) return;
    const action = KEYMAP[e.code];
    if (action) {
      input.keys.add(action);
      if (e.code === 'Space') e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => {
    const action = KEYMAP[e.code];
    if (action) input.keys.delete(action);
  });
  window.addEventListener('blur', () => input.keys.clear());

  let lastX = 0, lastY = 0;
  window.addEventListener('mousedown', (e) => {
    if (!input.enabled) return;
    if (e.target && (e.target.tagName === 'BUTTON' || e.target.closest('.overlay'))) return;
    input.dragging = true;
    lastX = e.clientX; lastY = e.clientY;
    input.clicked = true;
  });
  window.addEventListener('mouseup', () => { input.dragging = false; });
  window.addEventListener('mousemove', (e) => {
    if (!input.dragging) return;
    input.mouseDX += e.clientX - lastX;
    input.mouseDY += e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
  });

  // One-shot helpers: the game loop calls these once per frame.
  input.consumeClick = function consumeClick() {
    const c = input.clicked;
    input.clicked = false;
    return c;
  };
  input.consumeMouse = function consumeMouse() {
    const dx = input.mouseDX, dy = input.mouseDY;
    input.mouseDX = 0; input.mouseDY = 0;
    return { dx, dy };
  };
  input.pressed = function pressed(action) {
    return input.keys.has(action);
  };

  return input;
}
