import { expect, it } from 'vitest';
import { createCompetitionSourceReader, withCompetitionSourceReadScope } from './CompetitionSourceReadScope';
import { openSqliteNationCompetitionRegionStore } from './SqliteNationCompetitionRegionStore';

it('reuses identical Native source reads only within one synchronous operation', () => {
  const nations = openSqliteNationCompetitionRegionStore(':memory:');
  let reads = 0;
  const read = createCompetitionSourceReader((careerId: string, nationId: string, beforeDay: number) => {
    reads++; return nations.readRegion(careerId, nationId, beforeDay);
  });
  try {
    nations.record({ careerId: 'career-1', nationId: 'nation-1', region: 'EUROPE',
      effectiveFromDay: 0, sourceEventId: 'initial' });
    withCompetitionSourceReadScope(() => {
      expect(read('career-1', 'nation-1', 10)).toBe('EUROPE');
      withCompetitionSourceReadScope(() => expect(read('career-1', 'nation-1', 10)).toBe('EUROPE'));
      expect(read('career-1', 'nation-1', 0)).toBe('EUROPE');
    });
    expect(reads).toBe(2);
    nations.record({ careerId: 'career-1', nationId: 'nation-1', region: 'AMERICAS',
      effectiveFromDay: 10, sourceEventId: 'reform' });
    withCompetitionSourceReadScope(() => expect(read('career-1', 'nation-1', 10)).toBe('AMERICAS'));
    expect(reads).toBe(3);
    expect(() => withCompetitionSourceReadScope(() => read('career-1', 'nation-1', -1))).toThrow();
    expect(read('career-1', 'nation-1', 10)).toBe('AMERICAS');
    expect(read('career-1', 'nation-1', 10)).toBe('AMERICAS');
    expect(reads).toBe(6);
  } finally { nations.close(); }
});

it('keeps readers with the same arguments in separate source namespaces', () => {
  const first = openSqliteNationCompetitionRegionStore(':memory:');
  const second = openSqliteNationCompetitionRegionStore(':memory:');
  try {
    first.record({ careerId: 'career-1', nationId: 'nation-1', region: 'EUROPE', effectiveFromDay: 0, sourceEventId: 'first' });
    second.record({ careerId: 'career-1', nationId: 'nation-1', region: 'AFRICA', effectiveFromDay: 0, sourceEventId: 'second' });
    const readFirst = createCompetitionSourceReader(first.readRegion), readSecond = createCompetitionSourceReader(second.readRegion);
    withCompetitionSourceReadScope(() => {
      expect(readFirst('career-1', 'nation-1', 0)).toBe('EUROPE');
      expect(readSecond('career-1', 'nation-1', 0)).toBe('AFRICA');
    });
  } finally { first.close(); second.close(); }
});

it('preserves the source method receiver and separates instances sharing one method', () => {
  const first = openSqliteNationCompetitionRegionStore(':memory:');
  const second = openSqliteNationCompetitionRegionStore(':memory:');
  function lookup(this: { store: typeof first }, careerId: string, nationId: string, beforeDay: number) {
    return this.store.readRegion(careerId, nationId, beforeDay);
  }
  const firstOwner = { store: first, lookup }, secondOwner = { store: second, lookup };
  try {
    first.record({ careerId: 'career-1', nationId: 'nation-1', region: 'EUROPE', effectiveFromDay: 0, sourceEventId: 'first' });
    second.record({ careerId: 'career-1', nationId: 'nation-1', region: 'AFRICA', effectiveFromDay: 0, sourceEventId: 'second' });
    const readFirst = createCompetitionSourceReader(firstOwner.lookup, firstOwner);
    const readSecond = createCompetitionSourceReader(secondOwner.lookup, secondOwner);
    withCompetitionSourceReadScope(() => {
      expect(readFirst('career-1', 'nation-1', 0)).toBe('EUROPE');
      expect(readSecond('career-1', 'nation-1', 0)).toBe('AFRICA');
    });
  } finally { first.close(); second.close(); }
});

it('retries failed Native reads in the same active scope', () => {
  const nations = openSqliteNationCompetitionRegionStore(':memory:');
  let reads = 0;
  const read = createCompetitionSourceReader((careerId: string, nationId: string, beforeDay: number) => {
    reads++; return nations.readRegion(careerId, nationId, beforeDay);
  });
  try {
    withCompetitionSourceReadScope(() => {
      expect(() => read('career-1', 'nation-1', -1)).toThrow('invalid');
      expect(() => read('career-1', 'nation-1', -1)).toThrow('invalid');
      expect(reads).toBe(2);
    });
  } finally { nations.close(); }
});

it('rejects a pending source cycle without poisoning later reads in that scope', () => {
  let recursive: (id: string) => string;
  recursive = createCompetitionSourceReader((id: string): string => recursive(id));
  const nations = openSqliteNationCompetitionRegionStore(':memory:');
  try {
    nations.record({ careerId: 'career-1', nationId: 'nation-1', region: 'EUROPE', effectiveFromDay: 0, sourceEventId: 'first' });
    const read = createCompetitionSourceReader(nations.readRegion, nations);
    withCompetitionSourceReadScope(() => {
      expect(() => recursive('cycle')).toThrow('competition source dependency is cyclic');
      expect(() => recursive('cycle')).toThrow('competition source dependency is cyclic');
      expect(read('career-1', 'nation-1', 0)).toBe('EUROPE');
    });
  } finally { nations.close(); }
});
