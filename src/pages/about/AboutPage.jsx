import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Card, Icons } from '../../components/ui';
import BorneoMap from "../../assets/borneo_about.png";
import './about.css';

const dashboardRoute = '/';
const dataSourcesRoute = '/data-sources';

function useAboutContent(t) {
  const indicatorCards = [
    { title: t('about.indicatorForestCover'), tone: 'green', icon: TreeIcon, trend: 'M2 31 L14 25 L25 15 L37 19 L49 7 L62 12 L74 5' },
    { title: t('about.indicatorDeforestation'), tone: 'orange', icon: TreeLossIcon, trend: 'M2 10 L13 18 L24 13 L35 24 L47 20 L59 29 L72 25' },
    { title: t('about.indicatorWaterQuality'), tone: 'blue', icon: DropIcon, trend: 'M2 24 C13 14 24 32 36 22 S60 15 74 24' },
    { title: t('about.indicatorAirQuality'), tone: 'sky', icon: CloudIcon, trend: 'M2 14 C10 7 17 21 25 14 S39 8 47 15 S62 22 72 12' },
    { title: t('about.indicatorPoverty'), tone: 'amber', icon: HouseholdIcon, bars: [13, 22, 30, 18, 35, 24, 32, 39] },
    { title: t('about.indicatorFireHotspots'), tone: 'flame', icon: FlameIcon, bars: [25, 38, 18, 44, 32, 15, 41, 50] },
  ];

  const monitorItems = [
    {
      title: t('esg.categoryEnvironment'),
      body: t('about.monitorEnvironmentBody'),
      icon: ForestGroupIcon,
      tone: 'green',
    },
    {
      title: t('esg.categorySocial'),
      body: t('about.monitorSocialBody'),
      icon: Icons.People,
      tone: 'blue',
    },
    {
      title: t('about.monitorSustainabilityTitle'),
      body: t('about.monitorSustainabilityBody'),
      icon: GrowthIcon,
      tone: 'amber',
    },
  ];

  const exploreItems = [
    {
      title: t('about.exploreRegionalTitle'),
      body: t('about.exploreRegionalBody'),
      to: '/regions',
      icon: Icons.Chart,
      tone: 'green',
    },
    {
      title: t('esg.title'),
      body: t('about.exploreEsgBody'),
      to: '/esg',
      icon: LeafIcon,
      tone: 'green',
    },
    {
      title: t('sdg.title'),
      body: t('about.exploreSdgBody'),
      to: '/sdg',
      icon: SdgWheelIcon,
      tone: 'multi',
    },
    {
      title: t('sidebar.newsInsights'),
      body: t('about.exploreNewsBody'),
      to: '/news',
      icon: Icons.Newspaper,
      tone: 'green',
    },

    {
      title: t('sidebar.community'),
      body: t('about.exploreCommunityBody'),
      to: '/community',
      icon: Icons.People,
      tone: 'blue',
    },
  ];

  const scopeItems = [
    {
      title: t('about.scopeTerritoriesTitle'),
      body: t('about.scopeTerritoriesBody'),
      icon: GlobeIcon,
      tone: 'green',
    },
    {
      title: t('about.scopeEsgSdgTitle'),
      body: t('about.scopeEsgSdgBody'),
      icon: LeafIcon,
      tone: 'green',
    },
    {
      title: t('about.scopeSourcesTitle'),
      body: t('about.scopeSourcesBody'),
      icon: ShieldIcon,
      tone: 'amber',
    },
  ];

  return { indicatorCards, monitorItems, exploreItems, scopeItems };
}

export default function AboutPage() {
  const { t } = useTranslation();
  const { indicatorCards, monitorItems, exploreItems, scopeItems } = useAboutContent(t);
  return (
    <main className="about-page" aria-labelledby="about-title">
      <section className="about-hero" aria-label="About Borneo Tracker">
        <div className="about-hero-copy">
          <p className="about-kicker">{t('about.kicker')}</p>
          <h1 id="about-title">{t('about.heroTitle')}</h1>
          <p className="about-lede">
            {t('about.heroLede')}
          </p>
          <div className="about-actions" aria-label="Primary actions">
            <Link className="about-button about-button-primary" to={dashboardRoute} aria-label={t('about.exploreDashboard')}>
              {t('about.exploreDashboard')}
            </Link>
            <Link className="about-button about-button-secondary" to={dataSourcesRoute} aria-label={t('about.viewDataSources')}>
              {t('about.viewDataSources')}
              <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </div>

        <Card style={{ padding: 0 }} className="about-map-card">
          <div className="indicator-stack indicator-stack-left">
            {indicatorCards.slice(0, 3).map((item) => (
              <IndicatorCard key={item.title} item={item} />
            ))}
          </div>
          <BorneoVisual />
          <div className="indicator-stack indicator-stack-right">
            {indicatorCards.slice(3).map((item) => (
              <IndicatorCard key={item.title} item={item} />
            ))}
          </div>
        </Card>
      </section>

      <section className="about-purpose" aria-labelledby="purpose-title">
        <div>
          <h2 id="purpose-title">{t('about.ourPurpose')}</h2>
          <p>
            {t('about.purposeBody')}
          </p>
        </div>
        <div className="scope-grid" aria-label="Platform scope">
          {scopeItems.map((item) => (
            <InfoItem key={item.title} item={item} />
          ))}
        </div>
      </section>

      <Section title={t('about.whatWeMonitor')}>
        <div className="monitor-grid">
          {monitorItems.map((item) => (
            <InfoCard key={item.title} item={item} />
          ))}
        </div>
      </Section>

      <Section title={t('about.theResilienceScore')}>
        <p style={{ maxWidth: '72ch', color: 'var(--color-muted)', lineHeight: 1.65, margin: '0 0 22px' }}>
          <b style={{ color: 'var(--color-ink)' }}>{t('about.resilienceQuoted')}</b> {t('about.resilienceExplainerPart1')}{' '}
          <b style={{ color: 'var(--color-ink)' }}>{t('about.resilienceScoreLabel')}</b> {t('about.resilienceExplainerPart2')}
        </p>
        <div className="monitor-grid">
          <InfoCard
            item={{
              title: t('about.resilienceStatusTitle'),
              body: t('about.resilienceStatusBody'),
              icon: GrowthIcon,
              tone: 'green',
            }}
          />
          <InfoCard
            item={{
              title: t('dashboard.resilienceByPillar'),
              body: t('about.resilienceByPillarBody'),
              icon: HexagonIcon,
              tone: 'amber',
            }}
          />
        </div>
      </Section>

      <Section title={t('about.whatYouCanExplore')}>
        <div className="explore-grid">
          {exploreItems.map((item) => (
            <FeatureCard key={item.title} item={item} />
          ))}
        </div>
      </Section>

      <section className="about-bottom-grid" aria-label="Data transparency and notice">
        <div className="transparent-panel">
          <div className="about-icon-shell about-icon-green">
            <DatabaseShieldIcon size={54} />
          </div>
          <div>
            <h2>{t('about.builtOnTransparentData')}</h2>
            <p>
              {t('about.transparentDataBody')}
            </p>
          </div>
          <Link className="about-button about-button-secondary" to={dataSourcesRoute} aria-label={t('about.viewDataSources')}>
            {t('about.viewDataSources')}
            <span aria-hidden="true">↗</span>
          </Link>
        </div>

        <aside className="notice-panel" aria-labelledby="notice-title">
          <div className="about-icon-shell about-icon-amber">
            <Icons.Info size={34} />
          </div>
          <div>
            <h2 id="notice-title">{t('about.importantNotice')}</h2>
            <p>
              {t('about.noticeBody')}
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}

function Section({ title, children }) {
  const id = title.toLowerCase().replaceAll(' ', '-');
  return (
    <section className="about-section" aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      {children}
    </section>
  );
}

function IndicatorCard({ item }) {
  const Icon = item.icon;

  return (
    <div className="indicator-card">
      <span className={`indicator-icon indicator-${item.tone}`}>
        <Icon size={23} />
      </span>
      <span className="indicator-title">{item.title}</span>
      {item.bars ? (
        <MiniBars bars={item.bars} tone={item.tone} />
      ) : (
        <MiniTrend path={item.trend} tone={item.tone} />
      )}
    </div>
  );
}

function MiniTrend({ path, tone }) {
  return (
    <svg className={`mini-chart mini-chart-${tone}`} viewBox="0 0 76 36" aria-hidden="true">
      <path d={path} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MiniBars({ bars, tone }) {
  return (
    <svg className={`mini-chart mini-chart-${tone}`} viewBox="0 0 76 52" aria-hidden="true">
      {bars.map((height, index) => (
        <rect key={index} x={4 + index * 9} y={48 - height} width="4" height={height} rx="1.5" fill="currentColor" />
      ))}
    </svg>
  );
}

function InfoItem({ item }) {
  const Icon = item.icon;
  return (
    <article className="scope-item">
      <div className={`about-icon-shell about-icon-${item.tone}`}>
        <Icon size={34} />
      </div>
      <div>
        <h3>{item.title}</h3>
        <p>{item.body}</p>
      </div>
    </article>
  );
}

function InfoCard({ item }) {
  const Icon = item.icon;
  return (
    <Card className="about-info-card">
      <div className={`about-icon-shell about-icon-${item.tone}`}>
        <Icon size={40} />
      </div>
      <div>
        <h3>{item.title}</h3>
        <p>{item.body}</p>
      </div>
    </Card>
  );
}

function FeatureCard({ item }) {
  const Icon = item.icon;
  const content = (
    <>
      <div className={`about-icon-shell about-icon-${item.tone}`}>
        <Icon size={34} />
      </div>
      <div>
        <div className="feature-card-header">
          <h3>{item.title}</h3>
         
        </div>
        <p>{item.body}</p>
      </div>
    </>
  );

  return item.to ? (
    <Link className="feature-card" to={item.to} aria-label={`${item.title} page`}>
      {content}
    </Link>
  ) : (
    <article className="feature-card feature-card-static" aria-label={`${item.title} coming soon`}>
      {content}
    </article>
  );
}

function BorneoVisual() {
  return (
    <figure className="borneo-visual">
      <svg
        viewBox="0 0 320 240"
        role="img"
        aria-labelledby="borneo-map-title borneo-map-desc"
      >
        <title id="borneo-map-title">Borneo territory map</title>

        <desc id="borneo-map-desc">
          Decorative map with labeled regions for Sabah, Sarawak, Brunei and
          Kalimantan.
        </desc>

        <image
          href={BorneoMap}
          x="0"
          y="0"
          width="300"
          height="250"
          preserveAspectRatio="xMidYMid meet"
        />
      </svg>
    </figure>
  );
}

function TreeIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3 6.5 10h3L5 16h5v4h4v-4h5l-4.5-6h3L12 3Z" fill="currentColor" />
    </svg>
  );
}

function TreeLossIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3 7 9h3l-4 5h5v2.5h2V14h5l-4-5h3L12 3Z" fill="currentColor" />
      <path d="m5 20 14-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function DropIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3S5.5 10.1 5.5 15.1A6.5 6.5 0 0 0 18.5 15.1C18.5 10.1 12 3 12 3Z" fill="currentColor" />
    </svg>
  );
}

function CloudIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7.5 18h9a4 4 0 0 0 .8-7.9A6 6 0 0 0 6 11.5 3.3 3.3 0 0 0 7.5 18Z" fill="currentColor" />
    </svg>
  );
}

function HouseholdIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="3" fill="currentColor" />
      <circle cx="16" cy="8" r="3" fill="currentColor" opacity=".82" />
      <path d="M4 20c.8-3.6 2.8-5.3 6-5.3s5.2 1.7 6 5.3H4Z" fill="currentColor" />
      <path d="M12 20c.6-2.7 2.2-4.2 4.7-4.2 2.2 0 3.7 1.4 4.3 4.2h-9Z" fill="currentColor" opacity=".72" />
    </svg>
  );
}

function FlameIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12.7 3.2c1 3.5-.7 5.4-2 7.1-.9 1.2-1.5 2.4-.6 4 1.3-.9 2-2.1 2.2-3.7 3.2 2.1 5 4.2 5 7a5.3 5.3 0 0 1-10.6 0c0-2.2 1.1-4.1 2.8-6.2 1.6-1.9 3-3.9 3.2-8.2Z" fill="currentColor" />
    </svg>
  );
}

function GlobeIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="2" />
      <path d="M3.8 12h16.4M12 3.5c2.2 2.1 3.2 5 3.2 8.5s-1 6.4-3.2 8.5M12 3.5c-2.2 2.1-3.2 5-3.2 8.5s1 6.4 3.2 8.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function LeafIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20.5 3.5C13.4 3.8 7.2 7 5.4 12.3c-1 3 .2 5.5 2.7 6.5 5.5 2.2 11.2-5.5 12.4-15.3Z" fill="currentColor" />
      <path d="M5 20c3.8-5.2 7.5-8 12-10.4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" opacity=".9" />
    </svg>
  );
}

function ShieldIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3.5 19 6v5.5c0 4.7-2.7 7.7-7 9-4.3-1.3-7-4.3-7-9V6l7-2.5Z" stroke="currentColor" strokeWidth="2" />
      <path d="M8.5 12.2 11 14.7l4.7-5.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HexagonIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2.6 20 7.3v9.4L12 21.4 4 16.7V7.3L12 2.6Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M12 7.2v5l4.1 2.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity=".65" />
    </svg>
  );
}

function ForestGroupIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path d="M16 7 7 22h6L5 34h10v7h4v-7h10l-8-12h5L16 7Z" fill="currentColor" />
      <path d="M32 4 22 21h6l-8 13h10v7h4v-7h10l-8-13h6L32 4Z" fill="currentColor" opacity=".86" />
    </svg>
  );
}

function GrowthIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect x="8" y="27" width="7" height="13" rx="2" fill="currentColor" opacity=".74" />
      <rect x="21" y="20" width="7" height="20" rx="2" fill="currentColor" opacity=".88" />
      <rect x="34" y="13" width="7" height="27" rx="2" fill="currentColor" />
      <path d="M9 20c11.5-2.4 19.7-7.4 27-15" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M36 5h7v7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SdgWheelIcon({ size = 24 }) {
  const colors = ['#e5243b', '#dda63a', '#4c9f38', '#c5192d', '#ff3a21', '#26bde2', '#fcc30b', '#a21942', '#fd6925', '#dd1367', '#fd9d24', '#bf8b2e'];
  return (
    <svg width={size} height={size} viewBox="0 0 42 42" aria-hidden="true">
      {colors.map((color, index) => {
        const start = (index / colors.length) * 360;
        const end = ((index + 0.72) / colors.length) * 360;
        return <path key={color} d={arcPath(21, 21, 18, 10, start, end)} fill={color} />;
      })}
    </svg>
  );
}

function DatabaseShieldIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" fill="none" aria-hidden="true">
      <ellipse cx="21" cy="11" rx="15" ry="6" fill="currentColor" />
      <path d="M6 11v24c0 3.4 6.7 6 15 6 3.3 0 6.4-.4 8.8-1.2V11c-2.7 2.1-14.9 2.1-23.8 0Z" fill="currentColor" opacity=".9" />
      <path d="M6 23c3.2 2.4 17.7 3.1 24 0M6 34c3 2.3 14.5 3.2 23 1" stroke="#fff" strokeWidth="2" opacity=".85" />
      <path d="M39 26 51 30v8.5c0 7-4.7 11.2-12 13.2-7.3-2-12-6.2-12-13.2V30l12-4Z" fill="currentColor" />
      <path d="M33.5 38.5 37.5 42.5 45.5 34" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function arcPath(cx, cy, outer, inner, startAngle, endAngle) {
  const startOuter = polar(cx, cy, outer, endAngle);
  const endOuter = polar(cx, cy, outer, startAngle);
  const startInner = polar(cx, cy, inner, startAngle);
  const endInner = polar(cx, cy, inner, endAngle);
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;

  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${outer} ${outer} 0 ${largeArc} 0 ${endOuter.x} ${endOuter.y}`,
    `L ${startInner.x} ${startInner.y}`,
    `A ${inner} ${inner} 0 ${largeArc} 1 ${endInner.x} ${endInner.y}`,
    'Z',
  ].join(' ');
}

function polar(cx, cy, radius, angle) {
  const radians = ((angle - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians),
  };
}
