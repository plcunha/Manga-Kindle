/**
 * Configuration types for template-based connectors.
 * Each template defines a SiteConfig shape, and sites are
 * registered as simple config objects instead of full classes.
 */

/**
 * Base config shared by all template-based sites.
 */
export interface BaseSiteConfig {
  /** Unique site identifier (e.g. 'asurascans') */
  id: string;
  /** Human-readable label (e.g. 'Asura Scans') */
  label: string;
  /** Site base URL (e.g. 'https://asuratoon.com') */
  url: string;
  /** Language tag (default: 'en') */
  language?: string;
  /** Tags for categorization */
  tags?: string[];
}

/**
 * Config for WordPressMangastream-based sites.
 *
 * Mirrors HakuNeko's template: sites override selectors in constructor.
 * Defaults are provided for all selectors matching the Themesia
 * MangaStream WordPress theme.
 */
export interface WPMangastreamSiteConfig extends BaseSiteConfig {
  /** Path to the manga list page (default: '/manga/list-mode/') */
  path?: string;

  // --- Selectors (all have sensible defaults) ---

  /** CSS selector for manga links on the list page */
  queryMangas?: string;
  /** CSS selector for chapter links on the manga page */
  queryChapters?: string;
  /** CSS selector for chapter title within each chapter link */
  queryChaptersTitle?: string;
  /** CSS selector for image elements on the reader page */
  queryPages?: string;
  /** CSS selector for the manga title on its page (used for search-by-URL) */
  queryMangaTitle?: string;

  // --- Search ---

  /** Search URL path (default: '/' with ?s= query param) */
  searchPath?: string;
  /** CSS selector for search result links */
  querySearchResults?: string;
  /** CSS selector for cover image on search results */
  querySearchCover?: string;

  // --- Manga detail page selectors ---

  /** CSS selector for cover image on manga detail page */
  queryCover?: string;
  /** CSS selector for synopsis on manga detail page */
  querySynopsis?: string;

  // --- Custom page extraction ---

  /**
   * Regex patterns to filter out non-content images (ads, banners).
   * Images matching any of these patterns are excluded.
   */
  pageExcludes?: RegExp[];

  /**
   * Custom headers to send with requests.
   */
  headers?: Record<string, string>;
}
