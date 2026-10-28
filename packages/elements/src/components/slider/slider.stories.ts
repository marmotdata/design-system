import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn, waitFor } from 'storybook/test';
import { deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/slider.js';
import type { MmSlider } from './class.ts';

type Args = { label: string; min: number; max: number; step: number; value: number; unit: string; disabled: boolean; help: string; error: string };

const levels = (v: number) => `${v}\u00a0${v === 1 ? 'level' : 'levels'}`;

const meta: Meta<Args> = {
  title: 'Components/Forms/Slider',
  component: 'mm-slider',
  args: { label: 'Lineage depth', min: 1, max: 10, step: 1, value: 3, unit: '', disabled: false, help: 'How many hops upstream and downstream to draw.', error: '' },
  render: (a) => html`<mm-slider
    name="depth"
    label=${a.label}
    min=${a.min}
    max=${a.max}
    step=${a.step}
    value=${a.value}
    unit=${a.unit}
    help=${a.help}
    error=${a.error}
    ?disabled=${a.disabled}
    .format=${a.unit ? undefined : levels}
  ></mm-slider>`,
  parameters: {
    usage: {
      html: `<mm-slider name="depth" label="Lineage depth" min="1" max="10" value="3" unit="levels"></mm-slider>
<mm-slider name="rows" label="Row limit" min="100" max="10000" step="100" range value="1000" value-end="5000" unit="rows"></mm-slider>`,
      react: `import { MmSlider } from '@marmotdata/react';

<MmSlider label="Lineage depth" min={1} max={10} value={depth} unit="levels" onMmChange={(e) => setDepth(e.detail.value)} />
<MmSlider label="Row limit" range min={100} max={10000} step={100} value={low} valueEnd={high} unit="rows"
  onMmChange={(e) => setRows([e.detail.value, e.detail.valueEnd])} />`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/slider.js';
  let depth = $state(3);
</script>

<mm-slider label="Lineage depth" min="1" max="10" value={depth} unit="levels" onmm-change={(e) => (depth = e.detail.value)}></mm-slider>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

const host = (root: HTMLElement) => root.querySelector('mm-slider') as MmSlider;
const thumbs = (s: MmSlider) => [...s.shadowRoot!.querySelectorAll<HTMLElement>('[role="slider"]')];
const readout = (s: MmSlider) => s.shadowRoot!.querySelector('.readout')!.textContent!.trim();

export const Default: Story = {};
export const RowLimit: Story = {
  name: 'Range: row limit',
  render: () => html`<mm-slider name="rows" label="Row limit" range min="100" max="10000" step="100" value="1000" value-end="5000" unit="rows"></mm-slider>`,
};
export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Active: Story = { parameters: { pseudo: { active: true } } };
export const Focus: Story = {
  play: async ({ canvasElement }) => {
    await tab();
    await expect(deepActive()).toBe(thumbs(host(canvasElement))[0]);
  },
};
export const Disabled: Story = { args: { disabled: true } };
export const ErrorState: Story = {
  name: 'Error',
  args: { value: 10, error: 'Depth 10 draws more than 4,000 nodes. Choose 6 or fewer.', help: '' },
};
export const Overflowing: Story = {
  name: 'Overflowing content',
  render: () => html`<mm-slider
    style="width:220px"
    label="Maximum rows returned by the sampled preview query"
    min="100"
    max="1000000"
    step="100"
    value="284000"
    unit="rows"
  ></mm-slider>`,
};
export const RightToLeft: Story = {
  parameters: { dir: 'rtl' },
  render: () => html`<mm-slider label="عمق النسب" min="1" max="10" value="3"></mm-slider>`,
  play: async ({ canvasElement }) => {
    const s = host(canvasElement);
    await tab();
    await press('{ArrowLeft}');
    await expect(s.value).toBe(4);
    await press('{ArrowRight}{ArrowRight}');
    await expect(s.value).toBe(2);
  },
};
export const BothThemes: Story = {
  render: () =>
    themes(html`<div style="display:grid;gap:var(--space-5)">
      <mm-slider label="Lineage depth" min="1" max="10" value="3" .format=${levels}></mm-slider>
      <mm-slider label="Row limit" range min="100" max="10000" step="100" value="1000" value-end="5000" unit="rows"></mm-slider>
      <mm-slider label="Row limit" disabled min="100" max="10000" step="100" value="2500" unit="rows"></mm-slider>
    </div>`),
};

const onChange = fn();
const onInput = fn();
export const KeyboardModel: Story = {
  name: 'Keyboard: arrows, Page keys, Home and End',
  render: () => html`<mm-slider
    label="Lineage depth"
    min="1"
    max="10"
    value="3"
    .format=${levels}
    @mm-change=${(e: CustomEvent) => onChange(e.detail.value)}
    @mm-input=${(e: CustomEvent) => onInput(e.detail.value)}
  ></mm-slider>`,
  play: async ({ canvasElement }) => {
    onChange.mockClear();
    onInput.mockClear();
    const s = host(canvasElement);
    const [t] = thumbs(s);
    await tab();
    await expect(deepActive()).toBe(t);
    await expect(t).toHaveAccessibleName('Lineage depth');
    await expect(t).toHaveAttribute('aria-valuetext', '3\u00a0levels');
    await press('{ArrowRight}');
    await expect(s.value).toBe(4);
    await expect(onChange).toHaveBeenLastCalledWith(4);
    await expect(onInput).toHaveBeenLastCalledWith(4);
    await press('{ArrowUp}');
    await expect(s.value).toBe(5);
    await press('{ArrowLeft}{ArrowDown}');
    await expect(s.value).toBe(3);
    await press('{PageUp}');
    await expect(s.value).toBe(4);
    await press('{End}');
    await expect(s.value).toBe(10);
    await press('{ArrowRight}');
    await expect(s.value).toBe(10);
    await press('{Home}');
    await expect(s.value).toBe(1);
    await press('{PageDown}');
    await expect(s.value).toBe(1);
    await expect(t).toHaveAttribute('aria-valuenow', '1');
    await expect(readout(s)).toBe('1\u00a0level');
  },
};

export const RangeKeyboard: Story = {
  name: 'Keyboard: range thumbs',
  render: () => html`<mm-slider label="Row limit" range min="100" max="10000" step="100" value="1000" value-end="5000" unit="rows"></mm-slider>`,
  play: async ({ canvasElement }) => {
    const s = host(canvasElement);
    const [lo, hi] = thumbs(s);
    await expect(lo).toHaveAccessibleName('Minimum row limit');
    await expect(hi).toHaveAccessibleName('Maximum row limit');
    await expect(readout(s)).toBe('1,000–5,000\u00a0rows');
    await tab();
    await expect(deepActive()).toBe(lo);
    await press('{PageUp}');
    await expect(s.value).toBe(2000);
    await press('{End}');
    await expect(s.value).toBe(5000); // cannot pass the upper thumb
    await expect(hi).toHaveAttribute('aria-valuemin', '5000');
    await tab();
    await expect(deepActive()).toBe(hi);
    await press('{Home}');
    await expect(s.valueEnd).toBe(5000);
    await press('{End}');
    await expect(s.valueEnd).toBe(10000);
    await expect(hi).toHaveAttribute('aria-valuetext', '10,000\u00a0rows');
    await press('{ArrowLeft}');
    await expect(s.valueEnd).toBe(9900);
  },
};

export const Pointer: Story = {
  name: 'Pointer: click the track',
  render: () => html`<mm-slider label="Lineage depth" min="1" max="10" value="3" hide-ends style="width:300px"></mm-slider>`,
  play: async ({ canvasElement }) => {
    const s = host(canvasElement);
    const track = s.shadowRoot!.querySelector<HTMLElement>('.slider')!;
    const r = s.shadowRoot!.querySelector<HTMLElement>('.track')!.getBoundingClientRect();
    const at = (f: number) => ({ clientX: r.left + r.width * f, clientY: r.top, button: 0, pointerId: 1, bubbles: true, composed: true });
    track.dispatchEvent(new PointerEvent('pointerdown', at(1)));
    track.dispatchEvent(new PointerEvent('pointerup', at(1)));
    await expect(s.value).toBe(10);
    track.dispatchEvent(new PointerEvent('pointerdown', at(0.5)));
    track.dispatchEvent(new PointerEvent('pointermove', at(0)));
    track.dispatchEvent(new PointerEvent('pointerup', at(0)));
    await expect(s.value).toBe(1);
    await waitFor(() => expect(deepActive()).toBe(thumbs(s)[0]));
  },
};

const onSubmit = fn();
export const FormSubmission: Story = {
  name: 'Form: submit and reset',
  render: () => html`<form
    style="display:grid;gap:var(--space-4);max-width:360px"
    @submit=${(e: SubmitEvent) => {
      e.preventDefault();
      const fd = new FormData(e.target as HTMLFormElement);
      onSubmit({ depth: fd.get('depth'), rows: fd.getAll('rows'), ignored: fd.get('ignored') });
    }}
  >
    <mm-slider name="depth" label="Lineage depth" min="1" max="10" value="3"></mm-slider>
    <mm-slider name="rows" label="Row limit" range min="100" max="10000" step="100" value="1000" value-end="5000" unit="rows"></mm-slider>
    <fieldset disabled style="border:0;padding:0;margin:0">
      <mm-slider name="ignored" label="Disabled by its fieldset" min="1" max="10" value="5"></mm-slider>
    </fieldset>
    <div style="display:flex;gap:var(--space-2)"><button type="submit">Apply</button><button type="reset">Reset</button></div>
  </form>`,
  play: async ({ canvasElement }) => {
    onSubmit.mockClear();
    const form = canvasElement.querySelector('form')!;
    const [depth, rows, ignored] = [...canvasElement.querySelectorAll('mm-slider')] as MmSlider[];
    await waitFor(() => expect(thumbs(ignored!)[0]).toHaveAttribute('tabindex', '-1'));
    thumbs(depth!)[0]!.focus();
    await press('{ArrowRight}{ArrowRight}');
    thumbs(rows!)[1]!.focus();
    await press('{PageUp}');
    form.requestSubmit();
    await expect(onSubmit).toHaveBeenCalledWith({ depth: '5', rows: ['1000', '6000'], ignored: null });
    form.reset();
    await depth!.updateComplete;
    await expect(depth!.value).toBe(3);
    await expect(rows!.valueEnd).toBe(5000);
  },
};
