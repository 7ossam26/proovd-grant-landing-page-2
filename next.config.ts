import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a minimal, self-contained server build for the Docker runner stage.
  output: "standalone",
  async headers() {
    return [
      {
        // Next serves everything under public/ with `max-age=0` — measured
        // live: all ~4 MB of intro clips, story photos and stickers were
        // revalidated on EVERY visit, one ~160 ms round trip each for a
        // far-from-origin visitor, and nothing survived in the browser cache
        // between sessions. These files change rarely and are re-exported in
        // place when they do (same filename), so no `immutable`: a day of
        // freshness plus a year of stale-while-revalidate makes repeat
        // visits instant while an updated export still shows up within a
        // day — and the SWR revalidation happens off the critical path.
        source: "/assets/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=31536000",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
