// A person's Top 15 always starts with their Top 3, so the same three never have to be added twice.
// The Top 3 list stores ranks 1-3 and the Top 15 list only stores the picks after them; they are joined when read.
export const TOP15_MAX = 15;

// Top 3 first, then the rest of the Top 15 (minus anything already in the Top 3), cut to 15 in total
export function withTop3First(top3, rest, max = TOP15_MAX) {
  const taken = new Set(top3.map((i) => i.item_id));
  return [...top3, ...rest.filter((i) => !taken.has(i.item_id))].slice(0, max);
}

// The picks that belong in the stored Top 15 list: everything except what the Top 3 already holds
export function withoutTop3(items, top3) {
  const taken = new Set(top3.map((i) => i.item_id));
  return items.filter((i) => !taken.has(i.item_id));
}
