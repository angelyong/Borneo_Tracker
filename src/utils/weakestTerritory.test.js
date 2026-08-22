import { describe, expect, it } from 'vitest';
import { findWeakestTerritory } from './weakestTerritory';

describe('findWeakestTerritory', () => {
  it('picks the territory with the lowest index, and returns its own weakest pillar', () => {
    const result = findWeakestTerritory({
      Sabah: { index: 67.6, weakestPillar: 'Food' },
      Sarawak: { index: 73.6, weakestPillar: 'Education' },
      Brunei: { index: 78.0, weakestPillar: 'Food' },
      Kalimantan: { index: 67.7, weakestPillar: 'Education' },
    });
    expect(result).toEqual({ territory: 'Sabah', index: 67.6, weakestPillar: 'Food' });
  });

  it('ignores a territory with no scored index rather than treating it as the weakest', () => {
    const result = findWeakestTerritory({
      Sabah: { index: null, weakestPillar: null },
      Sarawak: { index: 73.6, weakestPillar: 'Education' },
    });
    expect(result.territory).toBe('Sarawak');
  });

  it('returns null when there are no scored territories at all', () => {
    expect(findWeakestTerritory({ Sabah: { index: null } })).toBeNull();
    expect(findWeakestTerritory({})).toBeNull();
    expect(findWeakestTerritory(null)).toBeNull();
  });

  it('returns weakestPillar: null rather than throwing if a territory has no weakestPillar field', () => {
    const result = findWeakestTerritory({ Sabah: { index: 50 } });
    expect(result).toEqual({ territory: 'Sabah', index: 50, weakestPillar: null });
  });
});
