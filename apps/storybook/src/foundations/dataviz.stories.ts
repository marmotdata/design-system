import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { md, section } from '../support/readme.ts';
import '../support/foundations.css';

const meta: Meta = { title: 'Foundations/Data visualisation', tags: ['!autodocs'] };
export default meta;

export const Rules: StoryObj = {
  render: () => html`<div class="fd">
    <h1>Data visualisation</h1>
    <p class="lede">Grey first, one colour, range-frame axes and direct labels. The chart components under Components/Data visualisation implement these rules; this page quotes them from the brand book.</p>
    ${md(section('Data visualisation', 3))}
    <h2>Signature details</h2>
    ${md(section('Signature details', 3))}
  </div>`,
};
