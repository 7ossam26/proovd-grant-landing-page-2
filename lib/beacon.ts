/** Fire-and-forget diagnostics.
 *
 *  Every failure path on this site degrades SILENTLY by design (fail-open
 *  try/catch, clip drops, crossfade fallbacks) — which is why the production
 *  intermittency had to be reconstructed forensically instead of read off a
 *  dashboard. These beacons are the counterweight: a handful of terminal
 *  datapoints (which intro path ran, whether the clip made it, fallbacks
 *  taken) riding the analytics that already ship in production.
 *
 *  Transport is Umami's custom-event API (self-hosted, already loaded by
 *  components/analytics.tsx in production). Where analytics are absent —
 *  dev, blocked, Save-Data — this is a no-op. A diagnostic must never break
 *  the page, so everything is wrapped and nothing is awaited. */

type UmamiLike = {
  track?: (name: string, data?: Record<string, unknown>) => void;
};

export function beacon(name: string, data?: Record<string, unknown>): void {
  try {
    const u = (window as Window & { umami?: UmamiLike }).umami;
    u?.track?.(name, data);
  } catch {
    /* never let telemetry take the page down with it */
  }
}
