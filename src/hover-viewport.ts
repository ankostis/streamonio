/**
 * Hover panel viewport sizing utilities.
 * Shared between page.ts (extension) and UI tests.
 */

export interface HoverViewport {
  width: number;
  height: number;
  needsScale: boolean;
  layoutScale: number;
  zoomValue: number;
}

/**
 * Calculate viewport dimensions for hover panel iframe.
 *
 * On mobile without viewport meta, layout width (innerWidth) differs from
 * physical width (screen.width). We counter-scale to maintain consistent size.
 * On desktop, layoutScale < 1 would incorrectly enlarge - use direct values.
 */
export function getHoverViewport(): HoverViewport {
  const layoutScale = window.innerWidth / screen.width;
  const needsScale = layoutScale > 1.1;
  const height = needsScale
    ? (window.visualViewport?.height ?? window.innerHeight) / layoutScale
    : (window.visualViewport?.height ?? window.innerHeight);

  return {
    width: screen.width,
    height,
    needsScale,
    layoutScale,
    zoomValue: needsScale ? layoutScale : 1,
  };
}
