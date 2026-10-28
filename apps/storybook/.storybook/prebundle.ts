/**
 * Dependencies Vite must pre-bundle before any story runs. If one is discovered mid-run Vite
 * re-optimises and reloads, which kills in-flight Vitest browser runs. Keep this list complete.
 * Packages that only @marmotdata/elements depends on use Vite's nested `parent > dep` syntax.
 */
export const prebundle = [
  'lit', 'lit/decorators.js', 'lit/directives/class-map.js', 'lit/directives/style-map.js', 'lit/directives/if-defined.js',
  'lit/directives/repeat.js', 'lit/directives/unsafe-html.js', 'lit/directives/unsafe-svg.js', 'lit/directives/live.js', 'lit/directives/ref.js',
  '@marmotdata/elements > @floating-ui/dom', '@marmotdata/elements > @lit-labs/virtualizer', '@marmotdata/elements > @lit-labs/virtualizer/virtualize.js', '@marmotdata/elements > @tanstack/virtual-core',
  '@marmotdata/elements > d3-scale', '@marmotdata/elements > d3-shape', '@marmotdata/elements > d3-contour', '@marmotdata/elements > d3-array', '@marmotdata/elements > d3-zoom', '@marmotdata/elements > d3-selection', '@marmotdata/elements > @dagrejs/dagre',
  '@marmotdata/elements > codemirror', '@marmotdata/elements > @codemirror/state', '@marmotdata/elements > @codemirror/view', '@marmotdata/elements > @codemirror/language', '@marmotdata/elements > @codemirror/autocomplete', '@marmotdata/elements > @codemirror/lint',
  '@marmotdata/elements > @codemirror/commands', '@marmotdata/elements > @codemirror/lang-sql', '@marmotdata/elements > @codemirror/lang-json', '@marmotdata/elements > @codemirror/lang-yaml', '@marmotdata/elements > @lezer/highlight',
  'lit/directives/guard.js', 'lit/directives/when.js', 'lit/directives/map.js', 'lit/directives/until.js', 'lit/directives/keyed.js',
  'lit/static-html.js', 'lit/async-directive.js', 'lit/directive.js',
  'react', 'react-dom/client', '@marmotdata/react > @lit/react',
  '@storybook/addon-a11y/preview', '@storybook/web-components-vite', 'storybook/test',
];
