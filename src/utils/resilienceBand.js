const RAG_BAND_LABEL_KEYS = {
  green: 'dashboard.bandGood',
  amber: 'dashboard.bandModerate',
  red: 'dashboard.bandPoor',
};

export function bandLabelKeyForRag(rag) {
  return RAG_BAND_LABEL_KEYS[rag] || null;
}
