// The metric registry — the single source of truth for usage measurement.
// (arecipe's measure-proof PR uses a YAML registry + a generator; here the same
// role is a typed TS module: MetricName is derived from the keys, so an
// undeclared metric is a compile error, and META is bundled so `expires` is
// honored at runtime with no server contact.)
//
// Every metric declares a plain-language `disclosure` shown to the user on the
// Metrics page, and an `expires` date after which the client stops emitting it
// on its own (a stale cached bundle retires a metric by itself).

export type MetricType = 'page' | 'feature' | 'timing' | 'edge';

export interface MetricMeta {
  /** page | feature | timing | edge. */
  readonly type: MetricType;
  /** Internal, for engineers. */
  readonly description: string;
  /** YYYY-MM-DD. Honored at runtime by the client. */
  readonly expires: string;
  /** Plain-language line shown to the user in the Metrics disclosure panel. */
  readonly disclosure: string;
  /** Open-world optional (page route hint, feature label, timing unit…). */
  readonly info?: string;
}

export const META = {
  page_home: {
    type: 'page',
    description: 'Opened the home page',
    expires: '2027-12-31',
    disclosure: 'That the home screen was opened',
    info: 'route',
  },
  page_guide: {
    type: 'page',
    description: 'Opened the user guide',
    expires: '2027-12-31',
    disclosure: 'That the guide was opened',
    info: 'route',
  },
  page_standards: {
    type: 'page',
    description: 'Opened the standards index',
    expires: '2027-12-31',
    disclosure: 'That the standards index was opened',
    info: 'route',
  },
  page_chassis: {
    type: 'page',
    description: 'Opened the chassis chapter',
    expires: '2027-12-31',
    disclosure: 'That the chassis chapter was opened',
    info: 'route',
  },
  page_brand: {
    type: 'page',
    description: 'Opened the brand chapter',
    expires: '2027-12-31',
    disclosure: 'That the brand chapter was opened',
    info: 'route',
  },
  page_pwa: {
    type: 'page',
    description: 'Opened the PWA-mechanics chapter',
    expires: '2027-12-31',
    disclosure: 'That the PWA-mechanics chapter was opened',
    info: 'route',
  },
  page_agent_method: {
    type: 'page',
    description: 'Opened the agent-method chapter',
    expires: '2027-12-31',
    disclosure: 'That the agent-method chapter was opened',
    info: 'route',
  },
  page_settings: {
    type: 'page',
    description: 'Opened the settings page',
    expires: '2027-12-31',
    disclosure: 'That the settings screen was opened',
    info: 'route',
  },
  page_metrics: {
    type: 'page',
    description: 'Opened the metrics page',
    expires: '2027-12-31',
    disclosure: 'That the metrics screen was opened',
    info: 'route',
  },
  page_atproto: {
    type: 'page',
    description: 'Opened the atproto/PDA page',
    expires: '2027-12-31',
    disclosure: 'That the atproto (PDA) page was opened',
    info: 'route',
  },
  feature_theme_toggle: {
    type: 'feature',
    description: 'Switched the light/dark theme',
    expires: '2027-12-31',
    disclosure: 'That the light/dark theme was switched',
    info: 'toggle',
  },
} as const satisfies Record<string, MetricMeta>;

export type MetricName = keyof typeof META;

/** The declared metrics as an array, for the disclosure panel. */
export const METRICS: readonly (readonly [MetricName, MetricMeta])[] = Object.entries(META) as [
  MetricName,
  MetricMeta,
][];
