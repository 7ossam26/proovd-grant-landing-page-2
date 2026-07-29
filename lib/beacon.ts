/** Fire-and-forget diagnostics.
 *
 *  Every failure path on this site degrades SILENTLY by design (fail-open
 *  try/catch, clip drops, crossfade fallbacks) — which is why the production
 *  intermittency had to be reconstructed forensically instead of read off a
 *  dashboard. These beacons are the counterweight: a handful of terminal
 *  datapoints (which intro path ran, whether the clip made it, fallbacks
 *  taken) riding the analytics that already ship in production.
 *
 *  Transport is Umami's custom-event API (self-hosted, loaded by
 *  components/analytics.tsx with strategy="afterInteractive"). Umami ships
 *  no pre-load stub, and the earliest beacons fire on wall-clock timers that
 *  routinely BEAT the tracker script on slow networks — the exact cohort the
 *  diagnostics exist to measure — so events queue until the tracker appears
 *  (bounded: QUEUE_MAX entries, FLUSH_TRIES polls) instead of being silently
 *  dropped. Where analytics never load — dev, blocked, Save-Data — the queue
 *  drains into the void when the polling gives up, and that is fine. A
 *  diagnostic must never break the page, so everything is wrapped and
 *  nothing is awaited. */

type UmamiLike = {
  track?: (name: string, data?: Record<string, unknown>) => void;
};

const QUEUE_MAX = 20;
const FLUSH_EVERY_MS = 2000;
const FLUSH_TRIES = 30; // give up after ~60s; the page's story is over by then

const queue: Array<[string, Record<string, unknown> | undefined]> = [];
let pollTimer: number | undefined;
let tries = 0;

function tracker(): UmamiLike["track"] | undefined {
  const u = (window as Window & { umami?: UmamiLike }).umami;
  return u?.track?.bind(u);
}

function drain(track: NonNullable<UmamiLike["track"]>): void {
  while (queue.length) {
    const [name, data] = queue.shift() as [
      string,
      Record<string, unknown> | undefined,
    ];
    track(name, data);
  }
}

function poll(): void {
  try {
    const track = tracker();
    if (track) {
      drain(track);
    }
    if ((track || ++tries >= FLUSH_TRIES) && pollTimer !== undefined) {
      window.clearInterval(pollTimer);
      pollTimer = undefined;
    }
  } catch {
    /* never let telemetry take the page down with it */
  }
}

export function beacon(name: string, data?: Record<string, unknown>): void {
  try {
    const track = tracker();
    if (track) {
      drain(track); // anything queued goes first, in order
      track(name, data);
      return;
    }
    if (queue.length < QUEUE_MAX) queue.push([name, data]);
    if (pollTimer === undefined && tries < FLUSH_TRIES) {
      pollTimer = window.setInterval(poll, FLUSH_EVERY_MS);
    }
  } catch {
    /* never let telemetry take the page down with it */
  }
}
