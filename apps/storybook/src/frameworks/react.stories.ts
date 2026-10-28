import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { createElement as h, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { expect, waitFor } from 'storybook/test';
import { MmButton, MmSwitch, MmTextField } from '@marmotdata/react';
import { click, press } from '../support/keys.ts';

/**
 * Smoke test for `@marmotdata/react`: the generated wrappers set properties (not just attributes),
 * deliver `mm-*` events to `onMm*` props with their detail, and re-render from React state.
 */
const meta: Meta = {
  title: 'Frameworks/React wrappers',
  parameters: { docs: { description: { component: 'The React wrappers rendered by React 19, with state flowing both ways.' } } },
};
export default meta;

function Form() {
  const [name, setName] = useState('orders_daily');
  const [certified, setCertified] = useState(false);
  const [saved, setSaved] = useState('');
  return h(
    'form',
    { className: 'mm-stack', style: { maxWidth: '24rem' }, onSubmit: (e: Event) => e.preventDefault() },
    h(MmTextField, { label: 'Asset name', value: name, mono: true, onMmInput: (e) => setName(e.detail.value) }),
    h(MmSwitch, { label: 'Certified', checked: certified, onMmChange: (e) => setCertified(e.detail.checked) }),
    h(MmButton, { variant: 'primary', onClick: () => setSaved(`${name}${certified ? ', certified' : ''}`) }, 'Save'),
    h('p', { role: 'status', 'data-testid': 'saved' }, saved ? `Saved ${saved}` : 'Not saved yet'),
  );
}

let root: Root | undefined;

export const Default: StoryObj = {
  render: () => {
    const host = document.createElement('div');
    root?.unmount();
    root = createRoot(host);
    root.render(h(Form));
    return host;
  },
  play: async ({ canvasElement }) => {
    const field = await waitFor(() => {
      const el = canvasElement.querySelector('mm-text-field');
      expect(el).not.toBeNull();
      return el!;
    });
    // The prop set the property, so the inner input shows it.
    await waitFor(() => expect(field.shadowRoot?.querySelector('input')?.value).toBe('orders_daily'));

    const input = field.shadowRoot!.querySelector('input')!;
    await click(input);
    await press('{End}_v2');
    const sw = canvasElement.querySelector('mm-switch')!;
    await click(sw.shadowRoot!.querySelector('[role=switch]')!);
    await waitFor(() => expect(sw.checked).toBe(true));

    await click(canvasElement.querySelector('mm-button')!);
    await waitFor(() => expect(canvasElement.querySelector('[data-testid=saved]')!.textContent).toBe('Saved orders_daily_v2, certified'));
  },
};
