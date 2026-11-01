import assert from 'node:assert/strict';

// Existing names/handedness IDs and their writers remain unchanged. No photos
// are invented or fetched; this is a slot preview for the two match cards.
export function portraitSlotChangesV114(css) {
  const changes = [{before: '</head>', after: '<style id="player-portrait-slots-v114">\n' + css + '\n</style>\n</head>'}];
  for (const [role, label] of [['pitcher', '投手'], ['batter', '打者']]) {
    const name = `<strong id="${role}-name"></strong><span id="${role}-hand" class="hand"></span>`,
      portrait = `<span id="${role}-portrait" class="player-portrait" role="img" aria-label="${label}の顔写真（未設定）"><svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><circle cx="24" cy="16" r="8" fill="currentColor"/><path d="M8 42v-4c0-9 7-14 16-14s16 5 16 14v4" fill="currentColor"/></svg></span>`;
    changes.push({before: '<div>' + name + '</div>', after: `<div class="player-identity"><div class="player-identity-text">${name}</div>${portrait}</div>`});
  }
  return changes;
}
export function replacePortraitSeamV114(html, before, after) {
  const index = html.indexOf(before);
  assert(index >= 0 && html.indexOf(before, index + before.length) < 0, 'Unique portrait presentation seam required');
  return html.slice(0, index) + after + html.slice(index + before.length);
}
export function applyPlayerPortraitSlotsV114(html, css) {
  for (const {before, after} of portraitSlotChangesV114(css)) html = replacePortraitSeamV114(html, before, after);
  return html;
}
