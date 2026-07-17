import { useTranslation } from 'react-i18next';
import { COUNTRY_OPTIONS, SORT_OPTIONS, TERRITORY_OPTIONS } from './newsUtils';

const NewsFilters = ({
  search,
  territory,
  country,
  topic,
  sort,
  topics,
  resultCount,
  onSearchChange,
  onTerritoryChange,
  onCountryChange,
  onTopicChange,
  onSortChange,
}) => {
  const { t } = useTranslation();
  const SENTINEL_LABEL_KEY = {
    'All Territories': 'news.allTerritories',
    'All Countries': 'news.allCountries',
    'All Topics': 'community.allTopics',
  };
  const SORT_LABEL_KEY = { latest: 'news.sortLatest', oldest: 'news.sortOldest' };

  return (
    <section className="news-filter-panel" aria-label="News search and filters">
      <label className="news-field news-search-field">
        <span>{t('common.search')}</span>
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={t('news.searchFieldPlaceholder')}
        />
      </label>

      <label className="news-field">
        <span>{t('regional.territory')}</span>
        <select value={territory} onChange={(event) => onTerritoryChange(event.target.value)}>
          {TERRITORY_OPTIONS.map((option) => (
            <option value={option} key={option}>
              {SENTINEL_LABEL_KEY[option] ? t(SENTINEL_LABEL_KEY[option]) : option}
            </option>
          ))}
        </select>
      </label>

      <label className="news-field">
        <span>{t('news.country')}</span>
        <select value={country} onChange={(event) => onCountryChange(event.target.value)}>
          {COUNTRY_OPTIONS.map((option) => (
            <option value={option} key={option}>
              {SENTINEL_LABEL_KEY[option] ? t(SENTINEL_LABEL_KEY[option]) : option}
            </option>
          ))}
        </select>
      </label>

      <label className="news-field">
        <span>{t('news.topic')}</span>
        <select value={topic} onChange={(event) => onTopicChange(event.target.value)}>
          {topics.map((option) => (
            <option value={option} key={option}>
              {SENTINEL_LABEL_KEY[option] ? t(SENTINEL_LABEL_KEY[option]) : option}
            </option>
          ))}
        </select>
      </label>

      <label className="news-field">
        <span>{t('news.sort')}</span>
        <select value={sort} onChange={(event) => onSortChange(event.target.value)}>
          {SORT_OPTIONS.map((option) => (
            <option value={option.value} key={option.value}>
              {t(SORT_LABEL_KEY[option.value])}
            </option>
          ))}
        </select>
      </label>

      <div className="news-result-count" aria-live="polite">
        {t('news.articlesCount', { count: resultCount })}
      </div>
    </section>
  );
};

export default NewsFilters;
