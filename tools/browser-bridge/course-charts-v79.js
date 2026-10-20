(function (root) {
  'use strict';
  const names = ['左翼', '左中間', '中堅', '右中間', '右翼'];
  const colors = { red: '#f5a6a5', blue: '#c8e5f4', gray: '#e5e9e7' };
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  const el = (name, text, className) => {
    const node = document.createElement(name);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  function average(value) { return finite(value) ? value.toFixed(3).replace(/^0\./, '.') : '—'; }
  function tally(node, data, label) {
    const row = data || {}, ab = row.ab ?? 0, h = row.h ?? 0, hr = row.hr ?? 0, pending = row.pending ?? 0;
    const avg = ab > 0 && pending === 0 ? (Object.hasOwn(row, 'average') ? row.average : h / ab) : null;
    const color = !finite(avg) ? 'gray' : avg >= .300 ? 'red' : avg <= .200 ? 'blue' : 'gray';
    node.style.background = colors[color];
    node.append(el('strong', label), el('b', average(avg)), el('span', `${ab}打数 ${h}安打`), el('span', `${hr}HR · 未確定${pending}`));
    if (pending > 0) node.append(el('small', `記録確認中${finite(row.knownAverage) ? ` · 確定分${average(row.knownAverage)}` : ''}`));
    if (ab > 0 && ab < 20) node.append(el('small', '少数打数'));
    node.setAttribute('aria-label', `${label}、打率${average(avg)}、${ab}打数、${h}安打、${hr}HR、未確定${pending}`);
  }
  function renderPublic(container, report) {
    if (!container || !report) throw Error('コース成績の表示先と記録を指定してください。');
    const grid = el('div', undefined, 'course-public-grid-v79');
    grid.setAttribute('role', 'group'); grid.setAttribute('aria-label', 'ストライクゾーン内の公開9コース実成績');
    const rows = Array.isArray(report.inside) ? report.inside : Object.values(report.inside || {});
    for (let i = 0; i < 9; i++) {
      const cell = el('div', undefined, 'course-tally-v79');
      tally(cell, rows[i], rows[i]?.label || `${['高め', '真ん中', '低め'][Math.floor(i / 3)]}・${['左', '中央', '右'][i % 3]}`);
      grid.append(cell);
    }
    const other = el('div', undefined, 'course-public-other-v79');
    for (const [key, label] of [['outside', 'ボールゾーン'], ['offGrid', '63マスの範囲外'], ...(report.missing ? [['missing', '位置の記録なし']] : [])]) {
      const cell = el('div', undefined, 'course-tally-v79'); tally(cell, report[key], label); other.append(cell);
    }
    const note = el('p', '固定の捕手側図。打率は確定した安打÷打数。記録確認中を含む区分は打率を未確定とし、確定分だけを別記します。', 'course-note-v79');
    container.replaceChildren(grid, other, note);
    return container;
  }
  function renderSpray(container, data) {
    if (!container || !data || !Array.isArray(data.ratios) || data.ratios.length !== 5
      || data.ratios.some(value => value !== null && (!finite(value) || value < 0))) throw Error('打球方向は5区分の有限な割合（未計測はnull）で指定してください。');
    const percent = value => value === null ? '—' : `${(value * 100).toFixed(1)}%`;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 400 230'); svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', names.map((name, i) => `${name} ${percent(data.ratios[i])}`).join('、'));
    svg.classList.add('course-spray-v79');
    const point = (angle, radius) => [200 + Math.sin(angle * Math.PI / 180) * radius, 220 - Math.cos(angle * Math.PI / 180) * radius];
    for (let i = 0; i < 5; i++) {
      const a = point(-45 + i * 18, 205), b = point(-27 + i * 18, 205), path = document.createElementNS(svg.namespaceURI, 'path');
      path.setAttribute('d', `M 200 220 L ${a[0]} ${a[1]} A 205 205 0 0 1 ${b[0]} ${b[1]} Z`);
      path.setAttribute('fill', ['#e3f2e9', '#d4e9de', '#c3e0d1', '#d4e9de', '#e3f2e9'][i]);
      path.setAttribute('stroke', '#4a7b60'); path.setAttribute('stroke-width', '1.5'); svg.append(path);
      const p = point(-36 + i * 18, 150), text = document.createElementNS(svg.namespaceURI, 'text');
      text.setAttribute('x', p[0]); text.setAttribute('y', p[1]); text.setAttribute('text-anchor', 'middle');
      text.setAttribute('fill', '#1e4932'); text.setAttribute('font-size', '12');
      for (const [j, value] of [names[i], percent(data.ratios[i]), ...(data.homeRuns ? [`${data.homeRuns[i] ?? 0}HR`] : [])].entries()) {
        const span = document.createElementNS(svg.namespaceURI, 'tspan'); span.setAttribute('x', p[0]); span.setAttribute('dy', j ? 16 : 0); span.textContent = value; text.append(span);
      }
      svg.append(text);
    }
    const list = el('ul', undefined, 'course-spray-list-v79');
    names.forEach((name, i) => list.append(el('li', `${name} ${percent(data.ratios[i])}${data.counts ? ` · ${data.counts[i] ?? 0}本` : ''}${data.homeRuns ? ` · ${data.homeRuns[i] ?? 0}HR` : ''}`)));
    container.replaceChildren(svg, list);
    if (data.total !== undefined) container.append(el('p', `確定フェア打球 ${data.total}本（バントを含む） · ファウル ${data.fouls ?? 0}本`, 'course-note-v79'));
    return container;
  }
  root.KneekuraCourseChartsV79 = Object.freeze({ version: 79, renderPublic, renderSpray });
})(globalThis);
