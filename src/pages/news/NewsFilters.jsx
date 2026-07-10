import { SORT_OPTIONS, TERRITORY_OPTIONS } from './newsUtils';

const NewsFilters = ({
  search,
  territory,
  category,
  sort,
  categories,
  resultCount,
  onSearchChange,
  onTerritoryChange,
  onCategoryChange,
  onSortChange,
}) => (
  <section className="news-filter-panel" aria-label="News search and filters">
    <label className="news-field news-search-field">
      <span>Search</span>
      <input
        type="search"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Search title, summary, territory, category, or tags"
      />
    </label>

    <label className="news-field">
      <span>Territory</span>
      <select value={territory} onChange={(event) => onTerritoryChange(event.target.value)}>
        {TERRITORY_OPTIONS.map((option) => (
          <option value={option} key={option}>
            {option}
          </option>
        ))}
      </select>
    </label>

    <label className="news-field">
      <span>Category</span>
      <select value={category} onChange={(event) => onCategoryChange(event.target.value)}>
        {categories.map((option) => (
          <option value={option} key={option}>
            {option}
          </option>
        ))}
      </select>
    </label>

    <label className="news-field">
      <span>Sort</span>
      <select value={sort} onChange={(event) => onSortChange(event.target.value)}>
        {SORT_OPTIONS.map((option) => (
          <option value={option.value} key={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>

    <div className="news-result-count" aria-live="polite">
      {resultCount} {resultCount === 1 ? 'article' : 'articles'}
    </div>
  </section>
);

export default NewsFilters;
