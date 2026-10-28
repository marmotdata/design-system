import type { ReactNode } from 'react';
import styles from './DoDont.module.css';

/** A pair of live examples: what to do and what not to do, each with a one-line reason. */
export function DoDont({ children }: { children: ReactNode }) {
  return <div className={styles.pair}>{children}</div>;
}

function Card({ kind, html, children }: { kind: 'do' | 'dont'; html: string; children: ReactNode }) {
  const isDo = kind === 'do';
  return (
    <figure className={`${styles.card} ${isDo ? styles.do : styles.dont}`}>
      <div className={styles.stage} dangerouslySetInnerHTML={{ __html: html }} />
      <figcaption className={styles.caption}>
        <span className={styles.verdict}>
          <mm-icon name={isDo ? 'check-circle' : 'cancel'} aria-hidden="true"></mm-icon>
          {isDo ? 'Do' : 'Don’t'}
        </span>
        <span>{children}</span>
      </figcaption>
    </figure>
  );
}

export const Do = (p: { html: string; children: ReactNode }) => <Card kind="do" {...p} />;
export const Dont = (p: { html: string; children: ReactNode }) => <Card kind="dont" {...p} />;
