// Validated categorical palette (dataviz reference order), stepped per mode.
// Category dots always sit next to the category name, so identity never
// depends on color alone.
const lightPalette = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
const darkPalette = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'];

const SYSTEM_CATEGORY_PATTERN = /^system-[a-z]+-(\d+)$/;

/**
 * Stable color for a category: seeded categories follow the palette order,
 * custom ones hash into it. The color never depends on rank or filters.
 */
export function categoryColor(categoryId: string, isDark: boolean): string {
  const palette = isDark ? darkPalette : lightPalette;
  const systemMatch = SYSTEM_CATEGORY_PATTERN.exec(categoryId);
  if (systemMatch) return palette[(Number(systemMatch[1]) - 1) % palette.length];

  let hash = 0;
  for (const character of categoryId) hash = (hash * 31 + character.charCodeAt(0)) % 1_000_003;
  return palette[hash % palette.length];
}
