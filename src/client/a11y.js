// Accessibility (Ticket-04 §4): key rebinding with conflict detection, captions / visual cues.

export const ACTIONS = [
  ['up', 'Đi lên'],
  ['down', 'Đi xuống'],
  ['left', 'Sang trái'],
  ['right', 'Sang phải'],
  ['jump', 'Nhảy'],
  ['dash', 'Lướt'],
  ['interact', 'Tương tác (nạp / châm dầu)'],
  ['pulse', 'Tỏa Sáng'],
  ['pause', 'Tạm dừng'],
];

export const DEFAULT_KEYS = {
  up: 'KeyW',
  down: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  jump: 'Space',
  dash: 'ShiftLeft',
  interact: 'KeyE',
  pulse: 'KeyF',
  pause: 'Escape',
};

export function keyLabel(code) {
  if (!code) return '—';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const names = {
    Space: 'Space', ShiftLeft: 'Shift trái', ShiftRight: 'Shift phải', ControlLeft: 'Ctrl trái', ControlRight: 'Ctrl phải',
    AltLeft: 'Alt trái', AltRight: 'Alt phải', Escape: 'Esc', Enter: 'Enter', Tab: 'Tab', Backspace: 'Backspace',
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', CapsLock: 'Caps',
  };
  return names[code] || code;
}

/** Map of code -> [actions] for codes used by more than one action. */
export function findConflicts(keys) {
  const by = {};
  for (const [a] of ACTIONS) (by[keys[a]] ||= []).push(a);
  return Object.fromEntries(Object.entries(by).filter(([, list]) => list.length > 1));
}

/** Renders the rebinding table into `root`. Calls onChange(keys) after every change. */
export function mountKeybinds(root, keys, onChange) {
  let capturing = null;
  const render = () => {
    const conflicts = findConflicts(keys);
    const bad = new Set(Object.values(conflicts).flat());
    root.innerHTML =
      ACTIONS.map(
        ([a, label]) => `<div class="row kb ${bad.has(a) ? 'conflict' : ''}"><span>${label}</span>
        <button class="btn keybtn" data-kb="${a}">${capturing === a ? 'Nhấn phím…' : keyLabel(keys[a])}</button></div>`,
      ).join('') +
      (Object.keys(conflicts).length
        ? `<p class="kb-warn" role="alert">⚠ Trùng phím: ${Object.entries(conflicts)
            .map(([c, list]) => `${keyLabel(c)} → ${list.map((x) => ACTIONS.find((y) => y[0] === x)[1]).join(', ')}`)
            .join('; ')}</p>`
        : '') +
      `<div class="btns"><button class="btn ghost" data-kb-reset>Khôi phục mặc định</button></div>`;
  };
  root.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.hasAttribute('data-kb-reset')) {
      Object.assign(keys, DEFAULT_KEYS);
      capturing = null;
      onChange(keys);
      render();
    } else if (b.dataset.kb) {
      capturing = b.dataset.kb;
      render();
    }
  });
  window.addEventListener(
    'keydown',
    (e) => {
      if (!capturing) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      keys[capturing] = e.code;
      capturing = null;
      onChange(keys);
      render();
    },
    true,
  );
  render();
  return { render, isCapturing: () => !!capturing };
}

/** Short on-screen captions (subtitles for sounds / events). */
export class Captions {
  constructor(el) {
    this.el = el;
  }

  say(text, kind = '') {
    const d = document.createElement('div');
    d.className = `cap ${kind}`;
    d.textContent = text;
    this.el.prepend(d);
    while (this.el.children.length > 4) this.el.lastChild.remove();
    setTimeout(() => d.remove(), 3500);
  }
}
