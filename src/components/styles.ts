/** Text link with a visible focus ring, used for every inline link in the app. */
export const LINK_CLASS =
    "inline-flex w-max items-center gap-1 rounded-sm text-sm font-medium text-brand underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

/**
 * Scroll margin that keeps an anchor target below the header and, from md up, the sticky summary bar.
 * SummaryBar publishes the measured heights as CSS variables; the fallbacks cover the first paint.
 */
export const SCROLL_TARGET_CLASS = "scroll-mt-20 md:scroll-mt-[calc(var(--summary-bottom,12rem)+0.5rem)]";

export const FILE_GROUP_CLASS = "flex scroll-mt-20 flex-col gap-3 md:scroll-mt-[calc(var(--summary-bottom,12rem)+0.5rem)]";
