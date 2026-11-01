/** Bounded provenance for generated editor marks. Player identity is untouched.
 * Only known editor tokens are coalesced; an unusually long opaque origin is
 * represented by its stable digest, never silently truncated into another ID. */
function digestV101(value: string): string {
  let hash = 14695981039346656037n;
  for (let i = 0; i < value.length; i++) hash = BigInt.asUintN(64, (hash ^ BigInt(value.charCodeAt(i))) * 1099511628211n);
  return hash.toString(16).padStart(16, '0');
}
export function markLiveAuthoringSourceV101(source: string, marker: string): string {
  if (typeof source !== 'string' || !source.length || source.trim() !== source || source.length > 200 || typeof marker !== 'string' || marker.length > 40
    || !/^(?:public-edited|trait-edited|independent-traits|maker-edited(?:-r\d+)?|swing-edited(?:-r\d+)?)$/.test(marker)) {
    throw Error('編集履歴IDが不正です。元JSONを保持して読み込み直してください。');
  }
  const known = /^(?:public-edited|trait-edited|independent-traits|maker-edited(?:-r\d+)?|swing-edited(?:-r\d+)?)$/;
  const origin: string[] = [], marks = new Map<string, string>();
  const key = (s: string) => s.replace(/-r\d+$/, '');
  const store = (token: string) => {
    const revision = token.match(/-r(\d+)$/), n = revision ? Number(revision[1]) : null;
    if (revision && !Number.isSafeInteger(n)) {
      const binding = 'legacy-revision-' + digestV101(token);
      if (!origin.includes(binding)) origin.push(binding);
      marks.set(key(token), key(token));
    } else marks.set(key(token), revision ? key(token) + '-r' + n : token);
  };
  for (const token of source.split(':')) {
    if (known.test(token)) store(token);
    else origin.push(token);
  }
  store(marker);
  const suffix = ':' + [...marks.values()].join(':');
  let root = origin.join(':');
  if ((root + suffix).length > 160) {
    root = 'authoring-origin-' + digestV101(root);
  }
  return root + suffix;
}
