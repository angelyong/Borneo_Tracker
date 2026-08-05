import { describe, expect, it } from 'vitest';
import { getEntityAliasStats, resolveAiChatEntities } from './entityResolver.ts';

function resolve(question, options = {}) {
  return resolveAiChatEntities(question, { language: 'en', region: '', ...options });
}

describe('entity resolver territories and regions', () => {
  it.each([
    ['Sabah', 'Sabah'],
    ['Sarawak', 'Sarawak'],
    ['Brunei', 'Brunei Darussalam'],
    ['Brunei Darussalam', 'Brunei Darussalam'],
    ['Kalimantan', 'Kalimantan'],
    ['Indonesian Borneo', 'Kalimantan'],
    ['Borneo-wide resilience', 'Borneo-wide'],
  ])('resolves %s', (term, expected) => {
    expect(resolve(`Show ${term} data`).territories).toContain(expected);
  });

  it('resolves multiple territories in one comparison question', () => {
    const result = resolve('Compare Sabah and Brunei energy.');
    expect(result.territories).toEqual(expect.arrayContaining(['Sabah', 'Brunei Darussalam']));
    expect(result.operations.comparison).toBe(true);
  });

  it('does not let region context override explicit territory wording', () => {
    const result = resolve('What is Sarawak resilience?', { region: 'Sabah' });
    expect(result.territories).toEqual(['Sarawak']);
  });
});

describe('entity resolver concepts and pillars', () => {
  it.each([
    ['food security', 'food'],
    ['education', 'education'],
    ['energy access', 'energy'],
    ['healthcare capacity', 'healthcare'],
    ['clean water access', 'clean_water_access'],
    ['internet use', 'internet_use'],
    ['forest cover', 'forest_cover'],
    ['fire hotspots', 'fire_hotspots'],
    ['poverty', 'poverty'],
    ['governance', 'governance'],
    ['resilience score', 'resilience'],
    ['skor daya tahan', 'resilience', 'ms'],
    ['litupan hutan', 'forest_cover', 'ms'],
    ['akses air bersih', 'clean_water_access', 'ms'],
  ])('resolves concept %s', (term, concept, language = 'en') => {
    const result = resolve(`Apakah ${term} Sabah?`, { language });
    expect(result.concepts).toContain(concept);
  });

  it('resolves hexagon pillars in English and Malay', () => {
    const result = resolve('Which Food and tenaga pillars are weakest?', { language: 'ms' });
    expect(result.pillars).toEqual(expect.arrayContaining(['Food', 'Energy']));
  });

  it('preserves multiple concepts', () => {
    const result = resolve('Compare forest cover and poverty in Sabah.');
    expect(result.concepts).toEqual(expect.arrayContaining(['forest_cover', 'poverty']));
  });

  it('keeps clean water separate from shelter', () => {
    const result = resolve('Is clean water access weak in Sabah?');
    expect(result.concepts).toContain('clean_water_access');
    expect(result.concepts).not.toContain('shelter');
  });
});

describe('entity resolver indicators', () => {
  it('resolves exact repository-supported indicator names', () => {
    const result = resolve('What is the Poverty rate (P0) for Kalimantan?');
    expect(result.indicators).toContain('Poverty rate (P0)');
  });

  it('distinguishes exact indicators from concept aliases', () => {
    const result = resolve('Show Internet use and internet trend.');
    expect(result.indicators).toContain('Internet use');
    expect(result.concepts).toContain('internet_use');
  });
});

describe('entity resolver operations and years', () => {
  it('detects comparison', () => {
    expect(resolve('compare Sabah and Brunei').operations.comparison).toBe(true);
  });

  it('detects trend and year range', () => {
    const result = resolve('Show poverty trend from 2020 to 2024.');
    expect(result.operations.trend).toBe(true);
    expect(result.yearRange).toEqual({ start: 2020, end: 2024 });
    expect(result.years).toEqual([2020, 2024]);
  });

  it('detects weakest and strongest pillar operations', () => {
    expect(resolve('Which is the weakest pillar?').operations.weakest).toBe(true);
    expect(resolve('Which is the strongest pillar?').operations.strongest).toBe(true);
  });

  it('detects target gap, SDG progress, latest, and Malay operations', () => {
    const result = resolve('Apakah jurang sasaran dan kemajuan SDG terkini?', { language: 'ms' });
    expect(result.operations.targetGap).toBe(true);
    expect(result.operations.sdgProgress).toBe(true);
    expect(result.operations.latest).toBe(true);
    expect(result.language).toBe('ms');
  });

  it('detects ranking terms', () => {
    expect(resolve('Rank territories by poverty.').operations.ranking).toBe(true);
  });

  it('detects a single year and latest/current phrase', () => {
    const result = resolve('Current Sabah resilience in 2024.');
    expect(result.years).toContain(2024);
    expect(result.operations.latest).toBe(true);
  });
});

describe('entity resolver districts', () => {
  it('resolves exact district matches from repository data', () => {
    const result = resolve('Show Kota Kinabalu district poverty.');
    expect(result.districts).toContain('Kota Kinabalu');
    expect(result.operations.districtLevel).toBe(true);
  });

  it('detects district-level question without a district name', () => {
    expect(resolve('Show district level poverty in Sabah.').operations.districtLevel).toBe(true);
  });

  it('returns ambiguity when multiple districts share the same normalized name', () => {
    const result = resolve('Show Samarahan district data.', {
      repositoryData: {
        districts: {
          rows: [
            { territory: 'Samarahan', parent: 'Sarawak', key: 'a' },
            { territory: 'SAMARAHAN', parent: 'Sabah', key: 'b' },
          ],
        },
      },
    });
    expect(result.districts).toEqual([]);
    expect(result.ambiguities[0]).toContain('Ambiguous district');
  });

  it('does not invent unknown districts', () => {
    const result = resolve('Show Atlantis district poverty.');
    expect(result.districts).toEqual([]);
  });
});

describe('entity resolver edge cases', () => {
  it('normalizes punctuation, case, and hyphens', () => {
    const result = resolve('FOREST-COVER, SABAH!!!');
    expect(result.concepts).toContain('forest_cover');
    expect(result.territories).toContain('Sabah');
  });

  it('avoids substring false positives', () => {
    const result = resolve('Tell me about energetic art festivals.');
    expect(result.concepts).not.toContain('energy');
    expect(result.concepts).not.toContain('air_quality');
  });

  it('handles empty questions', () => {
    const result = resolve('   ');
    expect(result.ambiguities).toContain('Empty question; no entities resolved.');
    expect(result.concepts).toEqual([]);
  });

  it('handles mixed English and Malay wording', () => {
    const result = resolve('Compare skor daya tahan Sabah and Sarawak.', { language: 'en' });
    expect(result.language).toBe('ms');
    expect(result.operations.comparison).toBe(true);
    expect(result.concepts).toContain('resilience');
  });

  it('returns empty entity arrays when no entity matches', () => {
    const result = resolve('Hello there.');
    expect(result.territories).toEqual([]);
    expect(result.concepts).toEqual([]);
    expect(result.indicators).toEqual([]);
  });

  it('reports alias statistics for final reporting', () => {
    const stats = getEntityAliasStats();
    expect(stats.territories.total).toBeGreaterThan(0);
    expect(stats.districts.total).toBeGreaterThan(100);
  });
});
