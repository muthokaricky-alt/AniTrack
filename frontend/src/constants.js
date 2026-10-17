export const STATUSES = [
  { key: 'watching', label: 'Watching' },
  { key: 'completed', label: 'Completed' },
  { key: 'on_hold', label: 'On hold' },
  { key: 'dropped', label: 'Dropped' },
  { key: 'plan_to_watch', label: 'Plan to watch' }
];

export const STATUS_LABEL = Object.fromEntries(STATUSES.map((s) => [s.key, s.label]));
