export function leadSourceLabel(row) {
  if (row.source === 'linkedin') return 'LinkedIn';
  if (row.source === 'combined') return 'Google Maps + LinkedIn';
  // Rows saved before source tracking were all Maps results.
  return 'Google Maps';
}

export function matchesLeadSource(row, source) {
  return source === 'all' || row.source === 'combined' ||
    (row.source === 'linkedin' ? source === 'linkedin' : source === 'google-maps');
}
