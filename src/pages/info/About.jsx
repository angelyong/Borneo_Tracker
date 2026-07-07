// About Borneo Tracker — static content page per the design.
import Layout from '../../components/Layout';
import { COLORS } from '../../theme';

const SECTIONS = [
  {
    title: 'About Borneo Tracker',
    body: `Borneo Tracker is a data visualization dashboard designed to monitor environmental, social, and sustainability-related indicators across Borneo. The system presents regional ESG and SDG information in a clear and visual format, allowing users to understand the overall resilience status of different areas.`,
  },
  {
    title: 'Our Purpose',
    body: `Borneo Tracker aims to support public awareness, regional monitoring, and sustainable development analysis. By presenting data in a clear visual format, the platform allows users to compare different regions, identify key issues, and understand the resilience status of different areas.`,
  },
  {
    title: 'What You Can Do?',
    list: [
      'View regional environmental and social indicators',
      'Track ESG-related performance across different areas',
      'Monitor SDG progress using visual dashboard summaries',
      'Submit community reports such as flood, pollution, fire, and other incidents',
      'View verified community reports on the dashboard',
      'Refer to listed data sources for transparency and reliability',
    ],
  },
  {
    title: 'Community Report Verification',
    body: `Users can submit incident reports with location details, photo evidence, and descriptions. Each submitted report will be reviewed before it is displayed publicly. This verification process helps reduce false reports and ensures that the information shown on the platform is more reliable.`,
  },
  {
    title: 'Data Transparency',
    body: `Borneo Tracker uses structured data sources to present regional information clearly. The data source section allows users to understand where the information comes from and how it supports the dashboard analysis.`,
  },
  {
    title: 'Safety Notice',
    body: `Borneo Tracker is designed to support awareness and monitoring. For emergencies such as serious floods, fires, or life-threatening situations, users should still contact the relevant official emergency services immediately.`,
  },
];

export default function About() {
  return (
    <Layout>
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '30px 24px 60px' }}>
        {SECTIONS.map((s) => (
          <section key={s.title} style={{ marginBottom: 34 }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: COLORS.ink, marginBottom: 10 }}>
              {s.title}
            </h2>
            {s.body && <p style={{ fontSize: 15.5, lineHeight: 1.65, margin: 0 }}>{s.body}</p>}
            {s.list && (
              <ul style={{ fontSize: 15.5, lineHeight: 1.9, margin: 0, paddingLeft: 22 }}>
                {s.list.map((li) => (
                  <li key={li}>{li}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </Layout>
  );
}
