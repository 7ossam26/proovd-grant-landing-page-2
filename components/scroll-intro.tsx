import type { CSSProperties, ReactNode } from "react";
import styles from "./scroll-intro.module.css";

type ScrollIntroProps = {
  children: ReactNode;
  name: string;
  screens: number;
};

/**
 * Supplies native reading distance and one sticky viewport to a section.
 * The child owns its visual timeline; lib/scroll-intro.ts only publishes a
 * reversible 0..1 progress value and never writes the document scroll.
 */
export function ScrollIntro({ children, name, screens }: ScrollIntroProps) {
  return (
    <div
      className={styles.track}
      data-scroll-intro={name}
      style={{ "--intro-screens": screens } as CSSProperties}
    >
      <div className={styles.stage} data-scroll-intro-stage>
        {children}
      </div>
    </div>
  );
}
