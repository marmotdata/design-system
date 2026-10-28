import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { md, section } from '../support/readme.ts';
import '../support/foundations.css';

const meta: Meta = { title: 'Foundations/Voice and copy', tags: ['!autodocs'] };
export default meta;

const examples: [string, string, string][] = [
  ['Run query', 'Run →', 'Verb plus object, no arrow'],
  ['Delete data product', 'Delete', 'Say what it destroys'],
  ['Added manually', 'Added by hand', 'Plain word over an idiom'],
  ['Who can see this data', 'ACL', 'Everyday words for any employee'],
  ['Manual · From rules', 'Manual · Dynamic', 'Labels match the sentences'],
  ['Good morning, Jane', 'Good morning, Jane. One pipeline failed overnight and 37 queries were refused.', 'Copy is static; the numbers live in KPI tiles'],
  ['▂▄▆█ (popularity bars)', 'Top 9% · 988 views', 'A visual when the figure changes nothing'],
  ['23 results', '23 assets match “orders AND @type = table”', 'Do not repeat state'],
  ['No assets have been catalogued from this source yet. Add a plugin to catalogue it.', 'Nothing here yet!', 'What is missing and what to do'],
  ['The run failed after 412 ms because the credentials expired. Update them in Plugins.', 'Oops, something went wrong', 'What failed, why, what next'],
  ['Marmot gives people and agents governed access to data.', 'Supercharge your data. Unlock insights.', 'No hype verbs or fragments'],
  ['Generated', '✨ Magic', 'A tag, never a sparkle'],
  ['3 owners', 'three owners', 'Numerals for counts'],
];

export const Copy: StoryObj = {
  name: 'Voice and copy',
  render: () => html`<div class="fd">
    <h1>Voice and copy</h1>
    <p class="lede">The source of truth for every word in Marmot: product, docs and marketing.</p>
    ${md(section('Copy'), 2)}
    <h2>Write this, not that</h2>
    <table class="fd-table">
      <thead><tr><th>Write</th><th>Not</th><th>Why</th></tr></thead>
      <tbody>
        ${examples.map(
          ([good, bad, why]) => html`<tr>
            <td>${good}</td>
            <td style="color:var(--mm-text-2);text-decoration:line-through">${bad}</td>
            <td style="color:var(--mm-text-2)">${why}</td>
          </tr>`,
        )}
      </tbody>
    </table>
    <h2>Typographic details</h2>
    <p class="fd-prose">Curly quotes (“catalog”), a real ellipsis (Loading…), non-breaking spaces in <code>10&nbsp;MB</code> and <code>⌘&nbsp;K</code>, numerals for counts. Sample data is specific and plausible: <code>orders_daily</code>, 1,284,019 rows, “Analytics Engineering”, “Jane Doe”.</p>
  </div>`,
};
