import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';
import { themes } from 'prism-react-renderer';

// Storybook is published with the docs, under /storybook. pathname:// keeps Docusaurus from treating it as a docs route.
const storybook = process.env.STORYBOOK_URL ?? 'pathname:///storybook';

const config: Config = {
  title: 'Marmot design system',
  tagline: 'Tokens, components and guidelines for building Marmot.',
  url: 'https://design.marmotdata.io',
  baseUrl: '/',
  favicon: 'img/marmot-wordmark.svg',
  onBrokenLinks: 'throw',
  // .md files are plain CommonMark (the generated guidelines); .mdx files can use components.
  markdown: { format: 'detect', hooks: { onBrokenMarkdownLinks: 'throw' } },
  customFields: { storybook },
  i18n: { defaultLocale: 'en-GB', locales: ['en-GB'] },
  clientModules: ['./src/client/elements.ts'],
  presets: [
    [
      'classic',
      {
        docs: { routeBasePath: '/', sidebarPath: './sidebars.ts', editUrl: 'https://github.com/marmotdata/design-system/edit/main/apps/docs/' },
        blog: false,
        theme: { customCss: './src/css/custom.css' },
      } satisfies Preset.Options,
    ],
  ],
  themeConfig: {
    colorMode: { respectPrefersColorScheme: true },
    navbar: {
      logo: { alt: 'Marmot', src: 'img/marmot-wordmark.svg', srcDark: 'img/marmot-wordmark-light.svg' },
      items: [
        { to: '/', label: 'Components', position: 'left', activeBaseRegex: '^/(components/.*)?$' },
        { to: '/do-and-dont', label: 'Do and don’t', position: 'left' },
        { to: '/foundations/principles', label: 'Foundations', position: 'left' },
        { href: `${storybook}/`, label: 'Storybook', position: 'right', target: '_self' },
        { href: 'https://github.com/marmotdata/design-system', label: 'GitHub', position: 'right' },
      ],
    },
    footer: {
      copyright: 'Code under the MIT licence. The Marmot name and logo are trademarks.',
    },
    prism: { theme: themes.github, darkTheme: themes.vsDark },
  } satisfies Preset.ThemeConfig,
};

export default config;
