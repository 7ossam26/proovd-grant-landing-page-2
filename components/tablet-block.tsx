import styles from "./tablet-block.module.css";

/**
 * Tablet / iPad block. The site supports laptop and phone; this covers
 * everything in between until a tablet posture is designed.
 *
 * Server component on purpose — no "use client", no JS, no hydration. Which
 * breakpoints it appears at lives entirely in tablet-block.module.css (see
 * the comment there); this file only supplies the words. It renders on every
 * device and is `display: none` unless one of those queries matches, so a
 * tablet never flashes a layout meant for something else.
 *
 * KEEP IN SYNC: components/intro-gate.tsx mirrors these queries so the intro
 * never buffers its 1.6 MB clip behind this cover.
 */
export function TabletBlock() {
  return (
    <div className={styles.block}>
      <div className={styles.inner}>
        <img
          className={styles.logo}
          src="/assets/Proovd Logo.webp"
          alt="Proovd"
          width={909}
          height={274}
          decoding="async"
        />
        <p className={styles.msg}>Proovd isn’t built for tablets yet.</p>
        <p className={styles.sub}>
          Open it on your laptop, or on your phone. Both are ready for you.
        </p>
      </div>
    </div>
  );
}
