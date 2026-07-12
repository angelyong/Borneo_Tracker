import { Icons, Select } from '../../components/ui';
import { COLORS, FONT, RADII, SHADOWS } from '../../theme';

const CommunityFilters = ({
  search,
  onSearchChange,
  topic,
  onTopicChange,
  territory,
  onTerritoryChange,
  topicOptions,
  territoryOptions,
  resultCount,
}) => {
  return (
    <div style={styles.wrap}>
      <div style={styles.searchBox}>
        <Icons.Search size={18} color={COLORS.muted} />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search discussions by topic, region, or keyword…"
          style={styles.searchInput}
          aria-label="Search community discussions"
        />
      </div>

      <Select value={topic} onChange={onTopicChange} options={topicOptions} style={styles.select} />
      <Select value={territory} onChange={onTerritoryChange} options={territoryOptions} style={styles.select} />

      <span style={styles.resultCount}>
        {resultCount} {resultCount === 1 ? 'discussion' : 'discussions'}
      </span>
    </div>
  );
};

const styles = {
  wrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
    marginBottom: 18,
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flex: '1 1 320px',
    minWidth: 240,
    padding: '10px 14px',
    borderRadius: RADII.pill,
    background: '#fff',
    border: `1px solid ${COLORS.border}`,
    boxShadow: SHADOWS.card,
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    fontSize: 14.5,
    fontFamily: FONT,
    color: COLORS.ink,
    background: 'transparent',
  },
  select: { minWidth: 160 },
  resultCount: {
    fontSize: 13.5,
    color: COLORS.muted,
    fontWeight: 600,
    whiteSpace: 'nowrap',
    marginLeft: 'auto',
  },
};

export default CommunityFilters;
