import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { intro, md, section } from '../support/readme.ts';
import '../support/foundations.css';

const meta: Meta = { title: 'Foundations/Design philosophy', tags: ['!autodocs'] };
export default meta;

export const Philosophy: StoryObj = {
  name: 'Design philosophy',
  render: () => html`<div class="fd">
    <h1>Design philosophy</h1>
    ${md(intro())}
    <h2>Principles</h2>
    ${md(section('Principles'))}
    <h2>What to avoid</h2>
    ${md(section('What to avoid'))}
    <h2>Easy to get wrong</h2>
    ${md(section('Using components').split('The components that are easiest to misuse:')[1]!.split('\n### ')[0]!.trim())}
    <h2>Before you ship a screen</h2>
    ${md(section('Before you ship a screen'))}
  </div>`,
};
