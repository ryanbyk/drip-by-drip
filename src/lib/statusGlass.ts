/** How far the strip fades in once content has moved under it. */
const GLASS_FADE_PX = 16;

/**
 * 0 at rest, including sub-pixel residue and the empty padding above the first
 * line. Rises to 1 as that line travels through the strip.
 */
export function statusGlassOpacity(scrollTop: number, paddingTop: number, bandHeight: number): number {
  const gap = Math.max(0, paddingTop - bandHeight);
  const travel = scrollTop - gap;
  if (travel <= 1) return 0;
  return Math.min(1, (travel - 1) / GLASS_FADE_PX);
}

/** True once scrolled content has crossed into the status strip. */
export function statusGlassActive(scrollTop: number, paddingTop: number, bandHeight: number): boolean {
  return statusGlassOpacity(scrollTop, paddingTop, bandHeight) > 0;
}
