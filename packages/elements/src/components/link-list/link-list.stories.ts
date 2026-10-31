import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect } from 'storybook/test';
import { deepActive, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/link-list.js';
import '@marmotdata/icons/define.js';

type Args = { columns: '1' | '2' };

const anchors = (root: Element) =>
  Array.from(root.querySelectorAll('mm-link-list-item')).map((i) => i.shadowRoot!.querySelector('a'));

const pages = [
  { href: '#/docs/deploy/docker-compose', icon: 'dns', title: 'Deploy with Docker Compose', description: 'Run Marmot and PostgreSQL on one machine.' },
  { href: '#/docs/plugins', icon: 'extension', title: 'Add a plugin', description: 'Catalog tables, topics and dashboards from your sources.' },
  { href: '#/docs/query', icon: 'database', title: 'Query data', description: 'Run SQL against connected sources, checked by policy.' },
  { href: '#/docs/agents', icon: 'smart-toy', title: 'Connect an agent', description: 'Give support-triage-agent governed access over MCP.' },
  { href: '#/docs/access', icon: 'shield', title: 'Control access', description: 'Decide who and what may query each asset.' },
  { href: '#/docs/lineage', icon: 'account-tree', title: 'Trace lineage', description: 'See where orders_daily comes from and what reads it.' },
];

const list = (columns: '1' | '2' = '1', icons = false) => html`<mm-link-list columns=${columns} aria-label="Next steps" style="max-width:${columns === '2' ? 880 : 560}px">
  ${pages.map(
    (p) => html`<mm-link-list-item href=${p.href} icon=${icons ? p.icon : ''} description=${p.description}>${p.title}</mm-link-list-item>`,
  )}
</mm-link-list>`;

const meta: Meta<Args> = {
  title: 'Components/Navigation/Link list',
  component: 'mm-link-list',
  args: { columns: '1' },
  argTypes: { columns: { control: 'inline-radio', options: ['1', '2'] } },
  render: (a) => list(a.columns),
  parameters: {
    docs: {
      description: {
        component:
          'Places to go, each a title and one line, in place of a grid of icon cards. Keyboard: every item is one link and Tab moves between them; Enter follows the link. Static pages use the `.mm-link-list` classes from `@marmotdata/css`.',
      },
    },
    usage: {
      html: `<mm-link-list columns="2" aria-label="Next steps">
  <mm-link-list-item href="/docs/deploy" icon="dns" description="Run Marmot and PostgreSQL on one machine.">Deploy with Docker Compose</mm-link-list-item>
  <mm-link-list-item href="https://github.com/marmotdata/marmot/discussions" external description="Ask questions and share what you built.">Community discussions</mm-link-list-item>
</mm-link-list>

<!-- Zero JS, from @marmotdata/css -->
<ul class="mm-link-list mm-link-list--2">
  <li><a class="mm-link-list__item" href="/docs/deploy" aria-describedby="deploy-d">
    <span class="mm-link-list__text"><span class="mm-link-list__title">Deploy with Docker Compose</span>
      <span class="mm-link-list__description" id="deploy-d" aria-hidden="true">Run Marmot and PostgreSQL on one machine.</span></span>
    <svg class="mm-link-list__indicator" aria-hidden="true">…chevron-right…</svg></a></li>
</ul>`,
      react: `import { MmLinkList, MmLinkListItem } from '@marmotdata/react';

<MmLinkList columns="2" aria-label="Next steps">
  {pages.map((p) => (
    <MmLinkListItem key={p.href} href={p.href} icon={p.icon} description={p.description} external={p.href.startsWith('http')}>
      {p.title}
    </MmLinkListItem>
  ))}
</MmLinkList>`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/link-list.js';
</script>

<mm-link-list columns="2" aria-label="Next steps">
  {#each pages as p (p.href)}
    <mm-link-list-item href={p.href} icon={p.icon} description={p.description} external={p.href.startsWith('http')}>{p.title}</mm-link-list-item>
  {/each}
</mm-link-list>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const [first] = anchors(canvasElement);
    const item = canvasElement.querySelector('mm-link-list-item')!;
    await expect(canvasElement.querySelector('mm-link-list')).toHaveAttribute('role', 'list');
    await expect(item).toHaveAttribute('role', 'listitem');
    // Named by the title; the description is attached, not repeated in the name.
    const description = item.shadowRoot!.querySelector('#description')!;
    await expect(first).toHaveAttribute('aria-describedby', 'description');
    await expect(description).toHaveAttribute('aria-hidden', 'true');
    await expect(first!.querySelector('mm-icon.indicator')).toHaveAttribute('name', 'chevron-right');
  },
};

export const WithIcons: Story = { name: 'With icons', render: () => list('1', true) };

export const WithProviderLogos: Story = {
  name: 'With provider logos',
  render: () => html`<mm-link-list aria-label="Plugins" style="max-width:560px">
    <mm-link-list-item href="#/docs/plugins/postgresql" description="Tables, views and their columns.">
      <mm-provider-logo slot="icon" provider="postgresql" decorative></mm-provider-logo>PostgreSQL
    </mm-link-list-item>
    <mm-link-list-item href="#/docs/plugins/kafka" description="Topics, schemas and consumer groups.">
      <mm-provider-logo slot="icon" provider="kafka" decorative></mm-provider-logo>Kafka
    </mm-link-list-item>
    <mm-link-list-item href="#/docs/plugins/snowflake" description="Databases, schemas, tables and query history.">
      <mm-provider-logo slot="icon" provider="snowflake" decorative></mm-provider-logo>Snowflake
    </mm-link-list-item>
  </mm-link-list>`,
};

const externals = html`<mm-link-list aria-label="Community" style="max-width:560px">
  <mm-link-list-item href="https://github.com/marmotdata/marmot/discussions" external icon="forum" description="Ask questions and share what you built.">Community discussions</mm-link-list-item>
  <mm-link-list-item href="https://github.com/marmotdata/marmot/issues" external icon="flag" description="Report a bug or ask for a feature.">Issue tracker</mm-link-list-item>
  <mm-link-list-item href="#/docs/contributing" icon="code" description="Build Marmot locally and open a pull request.">Contributing guide</mm-link-list-item>
</mm-link-list>`;

export const External: Story = {
  name: 'External links',
  render: () => externals,
  play: async ({ canvasElement }) => {
    const [ext, , internal] = anchors(canvasElement);
    await expect(ext).toHaveAttribute('target', '_blank');
    await expect(ext!.getAttribute('rel')).toContain('noopener');
    await expect(ext!.querySelector('mm-icon.indicator')).toHaveAttribute('name', 'open-in-new');
    await expect(ext!.querySelector('.visually-hidden')!.textContent).toContain('(opens in a new tab)');
    await expect(internal).not.toHaveAttribute('target');
    await expect(internal!.querySelector('mm-icon.indicator')).toHaveAttribute('name', 'chevron-right');
  },
};

export const TwoColumns: Story = {
  name: 'Two columns',
  args: { columns: '2' },
  render: () => list('2', true),
};

export const TwoColumnsNarrow: Story = {
  name: 'Two columns in a narrow container',
  render: () => html`<div style="max-width:380px">${list('2', true)}</div>`,
};

export const LongText: Story = {
  name: 'Long text wrapping',
  render: () => html`<mm-link-list columns="2" aria-label="Guides" style="max-width:720px">
    <mm-link-list-item href="#/a" icon="menu-book" description="Every option for the PostgreSQL, Snowflake and BigQuery plugins, including schedules, filters, credentials and how each one maps source metadata to catalog fields.">
      Configure every source plugin and its schedule
    </mm-link-list-item>
    <mm-link-list-item href="#/b" icon="key" description="Short line.">API keys</mm-link-list-item>
    <mm-link-list-item href="#/c" icon="schema" description="mrn://postgresql/table/shop.public.orders_daily_revenue_by_region_and_currency">
      Identifiers_that_never_break_like_shop_public_orders_daily_revenue_by_region
    </mm-link-list-item>
  </mm-link-list>`,
};

export const WithoutLinks: Story = {
  name: 'Items without a link',
  render: () => html`<mm-link-list columns="2" aria-label="What you get" style="max-width:720px">
    <mm-link-list-item icon="search" description="One search across every source.">Search the catalog</mm-link-list-item>
    <mm-link-list-item icon="account-tree" description="Column-level lineage from dbt and Airflow.">Lineage</mm-link-list-item>
  </mm-link-list>`,
};

export const Hover: Story = { args: { columns: '1' }, parameters: { pseudo: { hover: true } } };

export const Focus: Story = {
  play: async ({ canvasElement }) => {
    await tab();
    await expect(deepActive()).toBe(anchors(canvasElement)[0]);
  },
};

export const Keyboard: Story = {
  name: 'Keyboard: Tab moves between links',
  args: { columns: '2' },
  render: () => list('2', true),
  play: async ({ canvasElement }) => {
    const links = anchors(canvasElement);
    // Not a composite widget: every link is in the tab order, in source order.
    for (const link of links) {
      await tab();
      await expect(deepActive()).toBe(link);
    }
    await tab(true);
    await expect(deepActive()).toBe(links[links.length - 2]);
  },
};

export const ZeroJs: Story = {
  name: 'Zero-JS class from @marmotdata/css',
  render: () => html`<div style="max-width:880px">
    <ul class="mm-link-list mm-link-list--2" aria-label="Next steps">
      ${pages.slice(0, 4).map(
        (p, i) => html`<li>
          <a class="mm-link-list__item" href=${p.href} aria-describedby=${`zero-js-d${i}`}>
            <mm-icon class="mm-link-list__icon" name=${p.icon}></mm-icon>
            <span class="mm-link-list__text"
              ><span class="mm-link-list__title">${p.title}</span
              ><span class="mm-link-list__description" id=${`zero-js-d${i}`} aria-hidden="true">${p.description}</span></span
            >
            <mm-icon class="mm-link-list__indicator" name="chevron-right"></mm-icon>
          </a>
        </li>`,
      )}
      <li>
        <div class="mm-link-list__item">
          <span class="mm-link-list__text"
            ><span class="mm-link-list__title">Self-hosted</span
            ><span class="mm-link-list__description">Runs in your own infrastructure.</span></span
          >
        </div>
      </li>
    </ul>
  </div>`,
};

export const RightToLeft: Story = { name: 'Right to left', parameters: { dir: 'rtl' }, render: () => externals };

export const BothThemes: Story = {
  name: 'Both themes',
  render: () => themes(html`${list('2', true)}<div style="height:var(--space-6)"></div>${externals}`),
};
