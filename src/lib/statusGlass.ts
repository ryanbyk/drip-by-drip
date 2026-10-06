/** True once scrolled content has crossed into the status strip. */
export function statusGlassActive(scrollTop: number, paddingTop: number, bandHeight: number): boolean {
  const gap = Math.max(0, paddingTop - bandHeight);
  // A fraction of a pixel (iOS rubber-band residue) still counts as rest.
  return scrollTop > gap + 1;
}
