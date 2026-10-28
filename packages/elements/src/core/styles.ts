import { css } from 'lit';

/** Shared base for every element: box sizing, hidden, and the guidelines focus ring (2px ink, 2px offset). */
export const base = css`
  :host {
    box-sizing: border-box;
    -webkit-font-smoothing: antialiased;
  }
  :host([hidden]),
  [hidden] {
    display: none !important;
  }
  *,
  *::before,
  *::after {
    box-sizing: inherit;
  }
  :focus {
    outline: none;
  }
  :focus-visible {
    outline: var(--mm-focus-ring-width, 2px) solid var(--mm-text);
    outline-offset: var(--mm-focus-ring-offset, 2px);
  }
  ::selection {
    background: var(--mm-selected);
    color: var(--mm-text);
  }
`;

/** The guidelines focus ring as a mixin for elements that draw it on an inner part. */
export const focusRing = css`
  outline: var(--mm-focus-ring-width, 2px) solid var(--mm-text);
  outline-offset: var(--mm-focus-ring-offset, 2px);
`;

export const visuallyHidden = css`
  .visually-hidden {
    position: absolute !important;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
  }
`;

/** Type styles from tokens, as classes usable inside shadow roots. */
export const type = css`
  .t-body { font: var(--text-body); }
  .t-dense { font: var(--text-dense); }
  .t-label { font: var(--text-label); color: var(--mm-text-2); }
  .t-caption { font: var(--text-caption); color: var(--mm-text-3); }
  .t-mono { font: var(--text-mono); }
  .t-mono-dense { font: var(--text-mono-dense); }
  .num { font-variant-numeric: tabular-nums; }
`;
