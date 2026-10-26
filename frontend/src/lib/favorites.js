// A Top 15 always starts with the Top 3 (the same rule the server applies, see backend/src/top3.js).
export const TOP15_MAX = 15;

export function withTop3First(top3, rest, max = TOP15_MAX) {
  const taken = new Set(top3.map((i) => i.item_id));
  return [...top3, ...rest.filter((i) => !taken.has(i.item_id))].slice(0, max);
}
