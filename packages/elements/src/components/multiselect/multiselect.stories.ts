import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn, waitFor } from 'storybook/test';
import { click, deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/multiselect.js';
import type { MmMultiselect, MmOptionData } from './class.ts';

const tags = html`
  <mm-option value="pii" description="Contains personal data such as names, emails or addresses">pii</mm-option>
  <mm-option value="finance" description="Used in financial reporting">finance</mm-option>
  <mm-option value="certified" description="Reviewed and approved by the owning team">certified</mm-option>
  <mm-option value="gdpr" description="Subject to a data subject access request">gdpr</mm-option>
  <mm-option value="deprecated" description="Scheduled for removal; do not build on it">deprecated</mm-option>
  <mm-option value="marketing">marketing</mm-option>
  <mm-option value="orders">orders</mm-option>
`;

const owners: MmOptionData[] = [
  { value: 'team:analytics-engineering', label: 'Analytics Engineering', icon: 'group', description: '14 members' },
  { value: 'team:data-platform', label: 'Data Platform', icon: 'group', description: '9 members' },
  { value: 'team:finance-data', label: 'Finance Data', icon: 'group', description: '5 members' },
  { value: 'user:jane.doe', label: 'Jane Doe', icon: 'person', description: 'jane.doe@example.com', mono: true },
  { value: 'user:tomas.nowak', label: 'John Price', icon: 'person', description: 'tomas.nowak@example.com', mono: true },
  { value: 'agent:support-triage-agent', label: 'support-triage-agent', icon: 'smart-toy', description: 'Agent' },
];
const ownerSearch =
  (latency: number, fail = false) =>
  (q: string, signal: AbortSignal) =>
    new Promise<MmOptionData[]>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (fail) return reject(new Error('Directory unavailable'));
        const n = q.trim().toLowerCase();
        resolve(owners.filter((o) => !n || o.label.toLowerCase().includes(n)));
      }, latency);
      signal.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      });
    });

type Args = { label: string; placeholder: string; help: string; error: string; disabled: boolean; required: boolean; value: string; maxTags: number };

const meta: Meta<Args> = {
  title: 'Components/Forms/Multiselect',
  component: 'mm-multiselect',
  args: { label: 'Tags', placeholder: 'Add tags', help: '', error: '', disabled: false, required: false, value: 'pii,finance', maxTags: 3 },
  render: (a) => html`<mm-multiselect
    name="tags"
    label=${a.label}
    placeholder=${a.placeholder}
    help=${a.help}
    error=${a.error}
    value=${a.value}
    max-tags=${a.maxTags}
    ?disabled=${a.disabled}
    ?required=${a.required}
    >${tags}</mm-multiselect
  >`,
  parameters: {
    usage: {
      html: `<mm-multiselect name="tags" label="Tags" value="pii,finance" placeholder="Add tags">
  <mm-option value="pii">pii</mm-option>
  <mm-option value="finance">finance</mm-option>
  <mm-option value="certified">certified</mm-option>
</mm-multiselect>`,
      react: `import { MmMultiselect, MmOption } from '@marmotdata/react';

<MmMultiselect name="tags" label="Tags" value={tags} onMmChange={(e) => setTags(e.detail.value)}>
  <MmOption value="pii">pii</MmOption>
  <MmOption value="finance">finance</MmOption>
  <MmOption value="certified">certified</MmOption>
</MmMultiselect>`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/multiselect.js';
  let tags = $state(['pii', 'finance']);
</script>

<mm-multiselect name="tags" label="Tags" value={tags} onmm-change={(e) => (tags = e.detail.value)}>
  <mm-option value="pii">pii</mm-option>
  <mm-option value="finance">finance</mm-option>
  <mm-option value="certified">certified</mm-option>
</mm-multiselect>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

const host = (root: HTMLElement) => root.querySelector('mm-multiselect') as MmMultiselect;
const input = (m: MmMultiselect) => m.shadowRoot!.querySelector('input')!;
const isOpen = (m: MmMultiselect) => input(m).getAttribute('aria-expanded') === 'true';
const activeOf = (m: MmMultiselect) =>
  (m.querySelector('mm-option[active]') ?? m.shadowRoot!.querySelector('mm-option[active]'))?.getAttribute('value');
const removeButtons = (m: MmMultiselect) => [...m.shadowRoot!.querySelectorAll<HTMLButtonElement>('.tag-x')];

export const Default: Story = {};
export const EmptyValue: Story = { name: 'No values yet', args: { value: '' } };
export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Active: Story = { parameters: { pseudo: { active: true } } };
export const Focus: Story = {
  play: async ({ canvasElement }) => {
    await tab();
    await expect(deepActive()).toBe(input(host(canvasElement)));
  },
};
export const Disabled: Story = { args: { disabled: true } };
export const ErrorState: Story = { name: 'Error', args: { value: '', required: true, error: 'Add at least one tag so the asset shows up in governance reports.' } };
export const WithHelp: Story = { name: 'With help text', args: { help: 'Tags apply to every column in the asset.' } };

export const Open: Story = {
  name: 'Open listbox',
  play: async ({ canvasElement }) => {
    const m = host(canvasElement);
    input(m).focus();
    await press('{ArrowDown}');
    await waitFor(() => expect(isOpen(m)).toBe(true));
    await expect(m.shadowRoot!.querySelector('[role="listbox"]')).toHaveAttribute('aria-multiselectable', 'true');
    await expect(m.querySelector('mm-option[value="pii"]')).toHaveAttribute('aria-selected', 'true');
  },
};

export const Overflow: Story = {
  name: 'Overflowing content (+N)',
  args: { value: 'pii,finance,certified,gdpr,marketing,orders' },
  play: async ({ canvasElement }) => {
    const m = host(canvasElement);
    await expect(m.shadowRoot!.querySelectorAll('.tag').length).toBe(3);
    await expect(m.shadowRoot!.querySelector('.more')).toHaveTextContent('+3');
    await expect(m.shadowRoot!.querySelector('.more')).toHaveTextContent('3 more selected');
    input(m).focus();
    await waitFor(() => expect(m.shadowRoot!.querySelectorAll('.tag').length).toBe(6));
  },
};

export const LongLabels: Story = {
  name: 'Long identifiers',
  render: () => html`<mm-multiselect
    label="Upstream assets"
    style="width:340px"
    value="mrn://snowflake/table/analytics.marts_customer_360.customers_dim_with_lifetime_value_v3,mrn://kafka/topic/shop.orders.v2"
  >
    <mm-option value="mrn://snowflake/table/analytics.marts_customer_360.customers_dim_with_lifetime_value_v3" provider="snowflake" mono description="mrn://snowflake/table/analytics.marts_customer_360.customers_dim_with_lifetime_value_v3">customers_dim_with_lifetime_value_v3</mm-option>
    <mm-option value="mrn://kafka/topic/shop.orders.v2" provider="kafka" mono description="mrn://kafka/topic/shop.orders.v2">shop.orders.v2</mm-option>
    <mm-option value="mrn://postgresql/table/shop.public.orders_daily" provider="postgresql" mono description="mrn://postgresql/table/shop.public.orders_daily">orders_daily</mm-option>
  </mm-multiselect>`,
};

export const AsyncOwners: Story = {
  name: 'Async loader',
  render: () => html`<mm-multiselect name="owners" label="Owners" placeholder="Search teams, people and agents" .loader=${ownerSearch(250)}></mm-multiselect>`,
  play: async ({ canvasElement }) => {
    const m = host(canvasElement);
    input(m).focus();
    await press('data');
    await waitFor(() => expect(m.shadowRoot!.querySelectorAll('mm-option').length).toBe(2), { timeout: 2000 });
    await press('{ArrowDown}{Enter}');
    await waitFor(() => expect(m.value).toEqual(['team:data-platform']));
    // The tag keeps its label after the options reload for an empty query.
    await expect(m.shadowRoot!.querySelector('.tag-label')).toHaveTextContent('Data Platform');
    await expect(input(m).value).toBe('');
  },
};

export const Loading: Story = {
  render: () => html`<mm-multiselect label="Owners" .loader=${ownerSearch(3000)}></mm-multiselect>`,
  play: async ({ canvasElement }) => {
    const m = host(canvasElement);
    input(m).focus();
    await press('pri');
    await waitFor(() => expect(m.shadowRoot!.querySelector('.status')).toHaveTextContent('Searching'), { timeout: 1500 });
  },
};

export const LoadError: Story = {
  name: 'Load error with retry',
  render: () => html`<mm-multiselect label="Owners" .loader=${ownerSearch(100, true)}></mm-multiselect>`,
  play: async ({ canvasElement }) => {
    const m = host(canvasElement);
    input(m).focus();
    await press('pri');
    await waitFor(() => expect(m.shadowRoot!.querySelector('.retry')).not.toBeNull(), { timeout: 2000 });
  },
};

export const Empty: Story = {
  name: 'Empty (no results)',
  play: async ({ canvasElement }) => {
    const m = host(canvasElement);
    input(m).focus();
    await press('xyz');
    await waitFor(() => expect(m.shadowRoot!.querySelector('.status')).toHaveTextContent('No results'));
  },
};

export const RightToLeft: Story = { parameters: { dir: 'rtl' }, args: { label: 'الوسوم' } };

export const BothThemes: Story = {
  render: () =>
    themes(html`<div style="display:grid;gap:var(--space-4)">
      <mm-multiselect label="Tags" value="pii,finance,certified,gdpr,orders">${tags}</mm-multiselect>
      <mm-multiselect label="Tags" required error="Add at least one tag.">${tags}</mm-multiselect>
      <mm-multiselect label="Tags" disabled value="certified">${tags}</mm-multiselect>
    </div>`),
};

const onChange = fn();
export const KeyboardModel: Story = {
  name: 'Keyboard: toggle, Backspace, tags',
  render: () => html`<mm-multiselect label="Tags" @mm-change=${(e: CustomEvent) => onChange(e.detail.value)}>${tags}</mm-multiselect>`,
  play: async ({ canvasElement }) => {
    onChange.mockClear();
    const m = host(canvasElement);
    await tab();
    await press('{ArrowDown}');
    await waitFor(() => expect(activeOf(m)).toBe('pii'));
    await press('{Enter}');
    await expect(m.value).toEqual(['pii']);
    await expect(isOpen(m)).toBe(true); // stays open for more picks
    await press('{ArrowDown}{Enter}');
    await expect(m.value).toEqual(['pii', 'finance']);
    await expect(onChange).toHaveBeenLastCalledWith(['pii', 'finance']);
    // Enter on a selected option deselects it.
    await press('{Enter}');
    await expect(m.value).toEqual(['pii']);
    await press('{PageDown}');
    await expect(activeOf(m)).toBe('orders');
    await press('{PageUp}');
    await expect(activeOf(m)).toBe('pii');
    // Typing filters; picking clears the text.
    await press('cert');
    await waitFor(() => expect([...m.querySelectorAll('mm-option')].filter((o) => !o.hidden).length).toBe(1));
    await press('{ArrowDown}{Enter}');
    await expect(m.value).toEqual(['pii', 'certified']);
    await expect(input(m).value).toBe('');
    await press('{Escape}');
    await waitFor(() => expect(isOpen(m)).toBe(false));
    // Remove buttons are labelled with the value.
    await expect(removeButtons(m).map((b) => b.getAttribute('aria-label'))).toEqual(['Remove pii', 'Remove certified']);
    // Backspace in the empty field removes the last value.
    await press('{Backspace}');
    await expect(m.value).toEqual(['pii']);
    // Left arrow moves into the tags; Backspace removes the focused tag.
    await press('fin');
    await press('{ArrowDown}{Enter}{Escape}');
    await waitFor(() => expect(m.value).toEqual(['pii', 'finance']));
    await press('{ArrowLeft}');
    await waitFor(() => expect(deepActive()).toBe(removeButtons(m)[1]));
    await press('{ArrowLeft}');
    await expect(deepActive()).toBe(removeButtons(m)[0]);
    await press('{Delete}');
    await waitFor(() => expect(m.value).toEqual(['finance']));
    await expect(deepActive()).toBe(input(m));
    // Clicking a remove button removes that value.
    await click(removeButtons(m)[0]!);
    await waitFor(() => expect(m.value).toEqual([]));
  },
};

const onSubmit = fn();
export const FormSubmission: Story = {
  name: 'Form: multiple entries, validate and reset',
  render: () => html`<form
    style="display:grid;gap:var(--space-3);justify-items:start"
    @submit=${(e: SubmitEvent) => {
      e.preventDefault();
      onSubmit(new FormData(e.target as HTMLFormElement).getAll('tags'));
    }}
  >
    <mm-multiselect name="tags" label="Tags" required value="pii">${tags}</mm-multiselect>
    <fieldset disabled style="border:0;padding:0;margin:0">
      <mm-multiselect name="ignored" label="Disabled by its fieldset" value="finance">${tags}</mm-multiselect>
    </fieldset>
    <div style="display:flex;gap:var(--space-2)"><button type="submit">Save tags</button><button type="reset">Reset</button></div>
  </form>`,
  play: async ({ canvasElement }) => {
    onSubmit.mockClear();
    const form = canvasElement.querySelector('form')!;
    const [m, ignored] = [...canvasElement.querySelectorAll('mm-multiselect')] as MmMultiselect[];
    await expect(input(ignored!).disabled).toBe(true);
    input(m!).focus();
    await press('{ArrowDown}{ArrowDown}{Enter}{ArrowDown}{Enter}{Escape}');
    await waitFor(() => expect(m!.value).toEqual(['pii', 'finance', 'certified']));
    form.requestSubmit();
    await expect(onSubmit).toHaveBeenCalledWith(['pii', 'finance', 'certified']);
    await expect(new FormData(form).getAll('ignored')).toEqual([]);
    await press('{Backspace}{Backspace}{Backspace}');
    await waitFor(() => expect(m!.value).toEqual([]));
    await expect(form.checkValidity()).toBe(false);
    await expect(m!.validity.valueMissing).toBe(true);
    form.reset();
    await m!.updateComplete;
    await expect(m!.value).toEqual(['pii']);
    await expect(form.checkValidity()).toBe(true);
  },
};
