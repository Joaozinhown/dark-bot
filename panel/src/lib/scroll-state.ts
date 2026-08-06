export const BACK_TO_TOP_THRESHOLD = 480;
export const LONG_PAGE_MARGIN = 160;

interface VerticalScrollMetrics {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}

interface HorizontalScrollMetrics {
  scrollLeft: number;
  scrollWidth: number;
  clientWidth: number;
}

export function calculateVerticalScroll(metrics: VerticalScrollMetrics) {
  const available = Math.max(0, metrics.scrollHeight - metrics.clientHeight);
  return {
    isLongPage: available > LONG_PAGE_MARGIN,
    isScrolled: metrics.scrollTop > 8,
    showBackToTop: metrics.scrollTop > BACK_TO_TOP_THRESHOLD,
    progress: available === 0 ? 0 : Math.min(1, Math.max(0, metrics.scrollTop / available)),
  };
}

export function calculateHorizontalOverflow(metrics: HorizontalScrollMetrics) {
  return {
    left: metrics.scrollLeft > 1,
    right: metrics.scrollLeft + metrics.clientWidth < metrics.scrollWidth - 1,
  };
}
