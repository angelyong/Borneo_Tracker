// Data Sources — card grid linking to the external sources used by the pipeline.
import Layout from '../../components/Layout';
import { COLORS } from '../../theme';
import { Card } from '../../components/ui';

const SOURCES = [
  {
    name: 'Global Forest Watch',
    subtitle: 'Forest cover, tree-cover loss and VIIRS fire alerts',
    url: 'https://www.globalforestwatch.org/',
  },
  {
    name: 'DEPS agri report / World Bank',
    subtitle: 'Agricultural production and macro indicators',
    url: 'https://data.worldbank.org/',
  },
  {
    name: 'BPS',
    subtitle: 'Statistics Indonesia — Kalimantan provincial data',
    url: 'https://www.bps.go.id/',
  },
  {
    name: 'PLN Statistics',
    subtitle: 'Electrification and energy statistics',
    url: 'https://web.pln.co.id/',
  },
  {
    name: 'OpenDOSM / data.gov.my',
    subtitle: 'Malaysia official open data (Sabah & Sarawak)',
    url: 'https://open.dosm.gov.my/',
  },
  {
    name: 'WAQI',
    subtitle: 'World Air Quality Index — live AQI observations',
    url: 'https://waqi.info/',
  },
];

export default function DataSources() {
  return (
    <Layout>
      <div style={{ maxWidth: 980, margin: '0 auto', padding: '26px 20px 60px' }}>
        <h1 style={{ textAlign: 'center', fontSize: 26, fontWeight: 800, margin: '4px 0 26px' }}>
          Data Sources
        </h1>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22 }}>
          {SOURCES.map((s) => (
            <a key={s.name} href={s.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
              <Card
                style={{
                  textAlign: 'center',
                  padding: '38px 26px',
                  cursor: 'pointer',
                  transition: 'transform 0.12s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-3px)')}
                onMouseLeave={(e) => (e.currentTarget.style.transform = 'none')}
              >
                <div style={{ fontSize: 19, fontWeight: 800, color: COLORS.ink }}>{s.name}</div>
                <div style={{ fontSize: 14, color: COLORS.muted, marginTop: 10 }}>{s.subtitle}</div>
              </Card>
            </a>
          ))}
        </div>
      </div>
    </Layout>
  );
}
