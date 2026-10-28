import type { DetailedHTMLProps, HTMLAttributes } from 'react';

// Live examples render real mm-* elements; React passes their attributes through as strings.
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      [tag: `mm-${string}`]: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & Record<string, unknown>;
    }
  }
}
