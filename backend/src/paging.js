// "?page=3" from a query string to a safe limit and offset. Bad or missing input means page 1.
export const PER_PAGE = 24;
export const MAX_PAGE = 50;

export function parsePage(raw, perPage = PER_PAGE) {
  const n = typeof raw === 'string' && /^\d{1,4}$/.test(raw) ? Number(raw) : 1;
  const page = Math.min(Math.max(n, 1), MAX_PAGE);
  return { page, limit: perPage, offset: (page - 1) * perPage };
}
