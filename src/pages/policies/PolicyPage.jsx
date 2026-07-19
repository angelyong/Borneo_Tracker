import { Link } from 'react-router-dom';
import './policies.css';

const LAST_UPDATED = 'July 2026';

function PolicyPage({ title, description, sections }) {
  return (
    <main className="policy-page" aria-labelledby="policy-title">
      <div className="policy-shell">
        

        <header className="policy-hero">
        
          <h1 id="policy-title">{title}</h1>
          <p className="policy-description">{description}</p>
          <p className="policy-updated">Last updated: {LAST_UPDATED}</p>
        </header>

        <article className="policy-card">
          <p className="policy-notice">
            This page contains realistic mock content for the Borneo Tracker prototype and
            demonstration environment. It is not final legal advice and should not be treated as
            a policy reviewed by a lawyer.
          </p>

          {sections.map((section) => (
            <section className="policy-section" aria-labelledby={section.id} key={section.id}>
              <h2 id={section.id}>{section.title}</h2>
              {section.body.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </section>
          ))}
        </article>
      </div>
    </main>
  );
}

const privacySections = [
  {
    id: 'privacy-introduction',
    title: 'Introduction',
    body: [
      'Borneo Tracker is a sustainability intelligence platform that helps users browse ESG, SDG, map, and sustainability data across Borneo. This mock Privacy Policy explains, at a prototype level, how information may be handled when people use the website.',
    ],
  },
  {
    id: 'privacy-information-we-collect',
    title: 'Information We Collect',
    body: [
      'We may collect information that users provide directly, information created while using the website, and information needed to operate account, dashboard, community, and chatbot features.',
    ],
  },
  {
    id: 'privacy-account-information',
    title: 'Account Information',
    body: [
      'Registered users may provide details such as name, email address, password credentials, role, and profile information. Passwords should be managed through the authentication system and should not be shared with Borneo Tracker staff or entered into public areas of the site.',
    ],
  },
  {
    id: 'privacy-usage-device-information',
    title: 'Usage and Device Information',
    body: [
      'The platform may record general usage details such as pages viewed, dashboard filters, selected territories, browser type, device type, approximate region, and error logs to support reliability, security, and product improvement.',
    ],
  },
  {
    id: 'privacy-community-report-information',
    title: 'Community Report Information',
    body: [
      'Registered users may submit community reports, discussions, comments, images, or attachments about sustainability, livelihoods, wildlife, culture, or local issues. These submissions may include the topic, territory, description, timestamps, and any files or location context provided by the user.',
    ],
  },
  {
    id: 'privacy-how-we-use-information',
    title: 'How We Use Information',
    body: [
      'Information may be used to operate the platform, show relevant ESG and SDG content, support community reporting, maintain account security, troubleshoot technical issues, improve the user experience, and understand which features are useful to researchers, students, communities, and decision-makers.',
    ],
  },
  {
    id: 'privacy-ai-chatbot-interactions',
    title: 'AI Chatbot Interactions',
    body: [
      'Questions submitted to the AI chatbot may be processed to provide answers grounded in website knowledge and approved Borneo Tracker content. Users should not enter passwords, identity-card numbers, financial account details, health records, or other sensitive personal information into the chatbot.',
      'Chatbot outputs may be incomplete or imperfect, so users should review the related pages and displayed sources whenever possible.',
    ],
  },
  {
    id: 'privacy-cookies-technologies',
    title: 'Cookies and Similar Technologies',
    body: [
      'Borneo Tracker may use cookies, local storage, or similar technologies to remember preferences such as language, theme, authentication state, and notification settings. These technologies may also support analytics and security features in future versions.',
    ],
  },
  {
    id: 'privacy-data-sharing',
    title: 'Data Sharing',
    body: [
      'Prototype data may be shared with service providers that help host, authenticate, secure, analyze, or operate the platform. Community content may be visible to other users depending on the feature design. We do not describe any sale of personal information in this mock policy.',
    ],
  },
  {
    id: 'privacy-data-retention',
    title: 'Data Retention',
    body: [
      'Information may be retained for as long as needed to provide the service, maintain records, resolve disputes, improve the prototype, and meet operational or legal requirements. Retention periods may differ by feature and data type.',
    ],
  },
  {
    id: 'privacy-data-security',
    title: 'Data Security',
    body: [
      'The platform should use reasonable administrative, technical, and organizational safeguards suitable for a prototype. No online service can guarantee absolute security, and users should avoid submitting unnecessary sensitive information.',
    ],
  },
  {
    id: 'privacy-user-choices-rights',
    title: 'User Choices and Rights',
    body: [
      'Users may be able to update profile details, manage account access, change preferences, or request deletion or correction of certain information. Specific rights and request processes would need to be confirmed before production launch.',
    ],
  },
  {
    id: 'privacy-childrens-privacy',
    title: "Children's Privacy",
    body: [
      'Borneo Tracker is not designed to collect personal information from children. If a future public launch includes younger audiences, age-appropriate privacy and consent requirements should be reviewed before release.',
    ],
  },
  {
    id: 'privacy-changes-policy',
    title: 'Changes to This Policy',
    body: [
      'This mock Privacy Policy may be updated as the prototype changes, especially if authentication, community reporting, analytics, or chatbot features are expanded.',
    ],
  },
  {
    id: 'privacy-contact-us',
    title: 'Contact Us',
    body: [
      'For privacy questions about this prototype, contact the Borneo Tracker project team through the contact channel provided by the website owner or project administrator.',
    ],
  },
];

const termsSections = [
  {
    id: 'terms-acceptance',
    title: 'Acceptance of Terms',
    body: [
      'By using Borneo Tracker, users agree to follow these mock Terms of Use for the prototype and demonstration environment. If these terms are not acceptable, users should stop using the platform.',
    ],
  },
  {
    id: 'terms-about',
    title: 'About Borneo Tracker',
    body: [
      'Borneo Tracker is a sustainability intelligence platform for exploring ESG indicators, SDG progress, maps, sustainability news, community reports, and related data about Sabah, Sarawak, Brunei, and Kalimantan.',
    ],
  },
  {
    id: 'terms-eligibility-accounts',
    title: 'Eligibility and User Accounts',
    body: [
      'Users are responsible for maintaining accurate account information and protecting their login credentials. Accounts may be needed for community reporting, profile features, administrative tools, or other restricted areas.',
    ],
  },
  {
    id: 'terms-acceptable-use',
    title: 'Acceptable Use',
    body: [
      'Users should use the platform for education, research, monitoring, discussion, and general information. Usage should respect other users, local communities, source providers, and the integrity of the data shown on the website.',
    ],
  },
  {
    id: 'terms-prohibited-activities',
    title: 'Prohibited Activities',
    body: [
      'Users must not misuse the platform, attempt unauthorized access, disrupt service availability, upload malicious files, scrape data in a harmful way, impersonate others, or submit false, harmful, illegal, misleading, or abusive content.',
    ],
  },
  {
    id: 'terms-community-reports',
    title: 'Community Reports and User Content',
    body: [
      'Community reports must be submitted accurately and in good faith. Users should avoid unsupported allegations, private personal information, emergency claims that require immediate official response, or content that could harm people, communities, or ecosystems.',
      'Borneo Tracker may moderate, remove, or restrict user content that appears inaccurate, harmful, duplicative, inappropriate, or outside the purpose of the platform.',
    ],
  },
  {
    id: 'terms-sustainability-data',
    title: 'Sustainability Data and Third-Party Sources',
    body: [
      'ESG, SDG, environmental, and socioeconomic data may come from public or third-party sources. Data may be incomplete, delayed, differently defined, or not directly comparable between territories.',
    ],
  },
  {
    id: 'terms-ai-content',
    title: 'AI-Generated or AI-Assisted Content',
    body: [
      'AI chatbot responses, summaries, and AI-assisted content may be incomplete or incorrect. Users should review displayed sources, related pages, and official references before relying on any AI-generated answer.',
    ],
  },
  {
    id: 'terms-intellectual-property',
    title: 'Intellectual Property',
    body: [
      'The Borneo Tracker name, interface, code, design, text, generated summaries, and compiled datasets may be protected by intellectual property rights owned by the project team or relevant licensors. Third-party data and content remain subject to their own licenses and terms.',
    ],
  },
  {
    id: 'terms-external-links',
    title: 'External Links',
    body: [
      'The platform may link to external websites, data portals, publishers, or source documents. Borneo Tracker does not control those external services and is not responsible for their content, availability, or policies.',
    ],
  },
  {
    id: 'terms-availability-changes',
    title: 'Availability and Changes',
    body: [
      'Features, data, pages, routes, and integrations may change during prototype development. The platform may be unavailable from time to time for maintenance, testing, or data updates.',
    ],
  },
  {
    id: 'terms-disclaimer',
    title: 'Disclaimer',
    body: [
      'Borneo Tracker content is provided for education, research, and general information. Users should not treat it as their only source of professional, legal, financial, environmental, operational, emergency, or investment advice.',
    ],
  },
  {
    id: 'terms-liability',
    title: 'Limitation of Liability',
    body: [
      'To the extent allowed by applicable law, the prototype project team would not be responsible for losses arising from use of incomplete data, platform downtime, user-submitted reports, third-party sources, or AI-assisted outputs.',
    ],
  },
  {
    id: 'terms-suspension-termination',
    title: 'Suspension or Termination',
    body: [
      'Accounts or access may be suspended or terminated if users violate these mock terms, misuse the platform, compromise security, or submit content that creates meaningful risk for the project or other users.',
    ],
  },
  {
    id: 'terms-changes',
    title: 'Changes to the Terms',
    body: [
      'These mock terms may be revised as Borneo Tracker evolves. A production release should include terms reviewed for the final feature set, audience, jurisdictions, and data sources.',
    ],
  },
  {
    id: 'terms-contact',
    title: 'Contact Us',
    body: [
      'For questions about these mock Terms of Use, contact the Borneo Tracker project team through the contact channel provided by the website owner or project administrator.',
    ],
  },
];

const dataSections = [
  {
    id: 'data-purpose',
    title: 'Purpose of This Data Policy',
    body: [
      'This mock Data Policy explains how Borneo Tracker intends to present, integrate, label, and qualify sustainability data in the prototype. It is designed to support transparent ESG, SDG, environmental, and socioeconomic exploration.',
    ],
  },
  {
    id: 'data-categories',
    title: 'Data Categories',
    body: [
      'The platform may include environmental data, social indicators, governance indicators, SDG-related measures, map layers, resilience metrics, news metadata, and community report metadata. The availability of each category may differ by territory and feature.',
    ],
  },
  {
    id: 'data-geographic-coverage',
    title: 'Geographic Coverage',
    body: [
      'Borneo Tracker covers Sabah, Sarawak, Brunei, and Kalimantan. Some map layers may show districts, provinces, states, territories, or regional summaries depending on the source data available.',
    ],
  },
  {
    id: 'data-sources',
    title: 'Data Sources',
    body: [
      'Data may come from sources such as the World Bank, UN SDG resources, Global Forest Watch, NASA FIRMS, government open-data portals, and other public or third-party sources. This policy does not invent or guarantee real source availability, live API access, or update status.',
    ],
  },
  {
    id: 'data-collection-integration',
    title: 'Data Collection and Integration',
    body: [
      'Source data may be imported manually, fetched through approved scripts, reviewed by the project team, or transformed into public files used by the website. Integration steps should preserve source labels, units, geography, and year information whenever available.',
    ],
  },
  {
    id: 'data-validation',
    title: 'Data Validation',
    body: [
      'Data should be checked for source credibility, duplicate records, unexpected zeroes, missing values, incompatible units, geography mismatches, and obvious formatting errors before being shown in dashboard views.',
    ],
  },
  {
    id: 'data-transformation-standardisation',
    title: 'Data Transformation and Standardisation',
    body: [
      'Transformation may include normalizing territory names, aligning year fields, converting units, grouping indicators by ESG or SDG category, and preparing values for maps or charts. Transformations should be documented so users can understand how displayed indicators were prepared.',
    ],
  },
  {
    id: 'data-methodology',
    title: 'ESG and SDG Indicator Methodology',
    body: [
      'Indicators should be mapped to ESG pillars, SDG goals, and resilience views using documented rules. When methodology is incomplete or experimental, the interface should make that limitation clear rather than presenting the result as definitive.',
    ],
  },
  {
    id: 'data-update-frequency',
    title: 'Data Update Frequency',
    body: [
      'Data years, units, refresh timing, update frequency, and completeness may differ between Sabah, Sarawak, Brunei, and Kalimantan. Borneo Tracker should show the latest available year and source context when that information exists.',
    ],
  },
  {
    id: 'data-missing-incomplete',
    title: 'Missing or Incomplete Data',
    body: [
      'Missing values must appear as Unavailable, Not reported, No data, or an equivalent state instead of automatically appearing as zero. Zero should only be displayed when the source clearly reports a real zero value.',
    ],
  },
  {
    id: 'data-quality-limitations',
    title: 'Data Quality Limitations',
    body: [
      'Borneo Tracker may show data with different collection methods, definitions, spatial boundaries, or reporting cycles. Comparisons should be read with care, especially when one territory has more complete data than another.',
    ],
  },
  {
    id: 'data-ai-knowledge-sources',
    title: 'AI Knowledge Sources',
    body: [
      'The chatbot may only answer using content approved or imported into the Borneo Tracker knowledge builder. It should not invent real statistics, unpublished source availability, or API update status.',
    ],
  },
  {
    id: 'data-source-attribution',
    title: 'Source Attribution',
    body: [
      'Charts, tables, reports, and chatbot answers should display sources or related pages whenever possible. Source attribution should name the provider, dataset, publication year, and relevant link when those details are available.',
    ],
  },
  {
    id: 'data-corrections-feedback',
    title: 'Corrections and Feedback',
    body: [
      'Users may flag suspected errors, missing source details, inconsistent units, outdated values, or unclear methodology. Corrections should be reviewed before being incorporated into public dashboard data.',
    ],
  },
  {
    id: 'data-downloads-reuse',
    title: 'Data Downloads and Reuse',
    body: [
      'Any downloadable or exported data should retain source attribution, date context, and usage limitations. Reuse of third-party datasets must follow the original source licenses and terms.',
    ],
  },
  {
    id: 'data-policy-updates',
    title: 'Policy Updates',
    body: [
      'This mock Data Policy may be updated as the prototype adds sources, improves validation, expands the knowledge builder, or changes how ESG, SDG, and resilience indicators are calculated.',
    ],
  },
  {
    id: 'data-contact',
    title: 'Contact Us',
    body: [
      'For data questions, corrections, or feedback, contact the Borneo Tracker project team through the contact channel provided by the website owner or project administrator.',
    ],
  },
];

export function PrivacyPolicyPage() {
  return (
    <PolicyPage
      title="Privacy Policy"
      description="How the Borneo Tracker prototype may handle account, usage, community, and chatbot information."
      sections={privacySections}
    />
  );
}

export function TermsOfUsePage() {
  return (
    <PolicyPage
      title="Terms of Use"
      description="Ground rules for using Borneo Tracker's prototype dashboards, community tools, data pages, and AI-assisted features."
      sections={termsSections}
    />
  );
}

export function DataPolicyPage() {
  return (
    <PolicyPage
      title="Data Policy"
      description="How Borneo Tracker describes source coverage, data quality, methodology, attribution, and responsible reuse."
      sections={dataSections}
    />
  );
}

export default PolicyPage;
