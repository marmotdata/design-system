import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn } from 'storybook/test';
import { deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/file-drop.js';
import type { MmFileDrop } from './class.ts';

type Args = { label: string; help: string; error: string; accept: string; maxSize: string; multiple: boolean; required: boolean; disabled: boolean; loading: boolean };

const NBSP = ' ';
const file = (name: string, size: number, type = '') => new File([new Uint8Array(size)], name, { type, lastModified: 1_793_000_000_000 });
const manifest = () => file('manifest.json', 2_412_880, 'application/json');
const seed = () => file('seed_customers.csv', 184_302, 'text/csv');
const drop = (el: MmFileDrop) => el.shadowRoot!.querySelector<HTMLElement>('.zone')!;
const browseBtn = (el: MmFileDrop) => el.shadowRoot!.querySelector<HTMLButtonElement>('.browse')!;
const removeLabels = (el: MmFileDrop) => [...el.shadowRoot!.querySelectorAll('.remove')].map((b) => b.getAttribute('aria-label'));
const dataTransfer = (...files: File[]) => {
  const dt = new DataTransfer();
  files.forEach((f) => dt.items.add(f));
  return dt;
};

const meta: Meta<Args> = {
  title: 'Components/Forms/File drop',
  component: 'mm-file-drop',
  args: {
    label: 'dbt artefacts',
    help: 'Upload the manifest.json from your latest dbt build, plus any CSV seeds it references.',
    error: '',
    accept: '.json,.csv',
    maxSize: '10 MB',
    multiple: true,
    required: false,
    disabled: false,
    loading: false,
  },
  render: (a) => html`<div style="max-width:480px">
    <mm-file-drop
      name="artefacts"
      label=${a.label}
      help=${a.help}
      error=${a.error}
      accept=${a.accept}
      max-size=${a.maxSize}
      ?multiple=${a.multiple}
      ?required=${a.required}
      ?disabled=${a.disabled}
      ?loading=${a.loading}
    ></mm-file-drop>
  </div>`,
  parameters: {
    usage: {
      html: `<mm-file-drop name="manifest" label="dbt manifest" accept=".json" max-size="10 MB" required></mm-file-drop>
<mm-file-drop name="seeds" label="CSV seeds" accept=".csv,text/csv" max-size="10 MB" multiple></mm-file-drop>`,
      react: `import { MmFileDrop } from '@marmotdata/react';

<MmFileDrop
  name="manifest"
  label="dbt manifest"
  accept=".json"
  max-size="10 MB"
  required
  onMmChange={(e) => setFiles(e.detail)}
  onMmReject={(e) => console.warn(e.detail.map((r) => r.message))}
/>`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/file-drop.js';
  let files: File[] = $state([]);
</script>

<form method="POST" action="?/uploadManifest" enctype="multipart/form-data">
  <mm-file-drop
    name="manifest"
    label="dbt manifest"
    accept=".json"
    max-size="10 MB"
    required
    onmm-change={(e: CustomEvent<File[]>) => (files = e.detail)}
  ></mm-file-drop>
  <mm-button variant="primary" type="submit">Upload manifest</mm-button>
</form>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

const withFiles = (files: () => File[]) => async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  const el = canvasElement.querySelector('mm-file-drop')!;
  el.files = files();
  await el.updateComplete;
};

export const Default: Story = {};
export const Empty: Story = { name: 'Empty (single file)', args: { label: 'dbt manifest', help: 'Run dbt compile and upload target/manifest.json.', accept: '.json', multiple: false } };
export const WithFiles: Story = { play: withFiles(() => [manifest(), seed()]) };
export const Hover: Story = { parameters: { pseudo: { hover: true } }, play: withFiles(() => [manifest()]) };
export const Active: Story = { parameters: { pseudo: { active: true } } };

export const DragOver: Story = {
  name: 'Drag over',
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('mm-file-drop')!;
    await el.updateComplete;
    drop(el).dispatchEvent(new DragEvent('dragenter', { dataTransfer: dataTransfer(manifest(), seed()), bubbles: true, cancelable: true }));
    await el.updateComplete;
    await expect(drop(el)).toHaveClass('over');
    await expect(el.shadowRoot!.querySelector('.prompt')).toHaveTextContent('Release to add the files');
  },
};

export const Focus: Story = {
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('mm-file-drop')!;
    await el.updateComplete;
    await tab();
    await expect(deepActive()).toBe(browseBtn(el));
  },
};

export const Disabled: Story = { args: { disabled: true }, play: withFiles(() => [manifest()]) };

export const Loading: Story = {
  name: 'Loading (uploading)',
  args: { loading: true },
  play: async (ctx) => {
    await withFiles(() => [manifest(), seed()])(ctx);
    const el = ctx.canvasElement.querySelector('mm-file-drop')!;
    await new Promise((r) => setTimeout(r, 260));
    await el.updateComplete;
    await expect(el.shadowRoot!.querySelectorAll('.spinner').length).toBe(2);
    await expect(browseBtn(el)).toBeDisabled();
  },
};

export const ErrorState: Story = {
  name: 'Error',
  args: { error: 'The catalog could not parse manifest.json. Check it is valid JSON and upload it again.' },
  play: withFiles(() => [manifest()]),
};

export const ValidationMessages: Story = {
  name: 'Error: too large and wrong type',
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('mm-file-drop')!;
    await el.updateComplete;
    const rejected = fn();
    el.addEventListener('mm-reject', (e) => rejected((e as CustomEvent).detail.length));
    drop(el).dispatchEvent(
      new DragEvent('drop', { dataTransfer: dataTransfer(file('customers.csv', 14_000_000, 'text/csv'), file('manifest.yaml', 8_200), seed()), bubbles: true, cancelable: true }),
    );
    await el.updateComplete;
    const errors = [...el.shadowRoot!.querySelectorAll('.error')].map((p) => p.textContent!.trim());
    await expect(errors).toEqual([
      `customers.csv is 14${NBSP}MB; the limit is 10${NBSP}MB.`,
      'manifest.yaml is not an accepted file type. Choose a .json or .csv file.',
    ]);
    await expect(rejected).toHaveBeenCalledWith(2);
    await expect(el.files.map((f) => f.name)).toEqual(['seed_customers.csv']);
  },
};

export const OverflowingContent: Story = {
  name: 'Overflowing content',
  play: withFiles(() => [
    manifest(),
    file('run_results.json', 912_004, 'application/json'),
    file('catalog.json', 5_120_331, 'application/json'),
    seed(),
    file('seed_orders_daily.csv', 3_400_120, 'text/csv'),
    file('seed_country_codes.csv', 8_416, 'text/csv'),
    file('sources.json', 44_210, 'application/json'),
  ]),
};

export const LongIdentifiers: Story = {
  name: 'Long identifiers',
  render: (a) => html`<div style="max-width:320px">
    <mm-file-drop name="seeds" label="CSV seeds" accept=".csv" max-size=${a.maxSize} multiple></mm-file-drop>
  </div>`,
  play: withFiles(() => [
    file('seed_shop_public_orders_daily_rollup_by_region_and_channel_2026_10_27.csv', 9_812_400, 'text/csv'),
    file('mrn___postgresql_table_shop.public.customers_dim_snapshot.csv', 1_284_019, 'text/csv'),
  ]),
};

export const RightToLeft: Story = {
  name: 'Right to left',
  parameters: { dir: 'rtl' },
  args: { label: 'ملفات dbt', help: 'ارفع ملف manifest.json من آخر بناء.' },
  play: withFiles(() => [manifest()]),
};

export const BothThemes: Story = {
  render: () =>
    themes(html`<div style="display:grid;gap:var(--space-5)">
      <mm-file-drop name="a" label="dbt artefacts" accept=".json,.csv" max-size="10 MB" multiple .files=${[manifest(), seed()]}></mm-file-drop>
      <mm-file-drop name="b" label="dbt manifest" accept=".json" error="The catalog could not parse manifest.json. Check it is valid JSON and upload it again."></mm-file-drop>
      <mm-file-drop name="c" label="CSV seeds" accept=".csv" disabled></mm-file-drop>
    </div>`),
};

/* Keyboard and form behaviour */

export const KeyboardBrowse: Story = {
  name: 'Keyboard: Enter and Space open the file picker',
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('mm-file-drop')!;
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('input[type=file]')!;
    const opened = fn();
    input.click = opened;
    await tab();
    await expect(deepActive()).toBe(browseBtn(el));
    await press('{Enter}');
    await press(' ');
    await expect(opened).toHaveBeenCalledTimes(2);
    await expect(input).toHaveAttribute('accept', '.json,.csv');
    await expect(input.multiple).toBe(true);
  },
};

export const KeyboardRemove: Story = {
  name: 'Keyboard: remove files and keep focus',
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('mm-file-drop')!;
    el.files = [manifest(), seed()];
    await el.updateComplete;
    const changed = fn();
    el.addEventListener('mm-change', (e) => changed((e as CustomEvent<File[]>).detail.map((f) => f.name)));
    await tab();
    await expect(deepActive()).toBe(browseBtn(el));
    await tab();
    await expect(deepActive()).toHaveAttribute('aria-label', 'Remove manifest.json');
    await press('{Enter}');
    await el.updateComplete;
    await expect(changed).toHaveBeenLastCalledWith(['seed_customers.csv']);
    await expect(deepActive()).toHaveAttribute('aria-label', 'Remove seed_customers.csv');
    await press(' ');
    await el.updateComplete;
    await expect(el.files).toEqual([]);
    await expect(deepActive()).toBe(browseBtn(el));
  },
};

export const BrowseAddsFiles: Story = {
  name: 'Browse: chosen files are added',
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('mm-file-drop')!;
    await el.updateComplete;
    const nativeChange = fn();
    el.addEventListener('change', nativeChange);
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('input[type=file]')!;
    input.files = dataTransfer(manifest()).files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await el.updateComplete;
    await expect(removeLabels(el)).toEqual(['Remove manifest.json']);
    await expect(nativeChange).toHaveBeenCalledTimes(1);
    await expect(el.shadowRoot!.querySelector('.size')!.textContent).toBe(`2.4${NBSP}MB`);
  },
};

export const SingleFileReplaces: Story = {
  name: 'Single file: a new file replaces the old one',
  args: { label: 'dbt manifest', accept: '.json', multiple: false, help: '' },
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('mm-file-drop')!;
    el.files = [manifest()];
    await el.updateComplete;
    drop(el).dispatchEvent(new DragEvent('drop', { dataTransfer: dataTransfer(file('manifest_prod.json', 3_100_000), file('catalog.json', 200)), bubbles: true, cancelable: true }));
    await el.updateComplete;
    await expect(el.files.map((f) => f.name)).toEqual(['manifest_prod.json']);
    await expect(el.shadowRoot!.querySelector('.error')).toHaveTextContent('Only one file can be added, so catalog.json was left out.');
  },
};

const submitted = fn();
export const SubmitsAndResets: Story = {
  name: 'Form: submits files, validates required and resets',
  render: () => html`<form
    style="max-width:480px;display:grid;gap:var(--space-4)"
    @submit=${(e: SubmitEvent) => {
      e.preventDefault();
      submitted(new FormData(e.target as HTMLFormElement).getAll('artefacts').map((f) => (f as File).name));
    }}
  >
    <mm-file-drop name="artefacts" label="dbt artefacts" accept=".json,.csv" max-size="10 MB" multiple required></mm-file-drop>
    <div><button type="submit">Upload artefacts</button> <button type="reset">Clear</button></div>
  </form>`,
  play: async ({ canvasElement }) => {
    submitted.mockClear();
    const form = canvasElement.querySelector('form')!;
    const el = canvasElement.querySelector('mm-file-drop')!;
    await el.updateComplete;
    await expect(form.checkValidity()).toBe(false);
    await expect(el.validity.valueMissing).toBe(true);
    el.addFiles([manifest(), seed()]);
    await el.updateComplete;
    await expect(form.checkValidity()).toBe(true);
    form.requestSubmit();
    await expect(submitted).toHaveBeenCalledWith(['manifest.json', 'seed_customers.csv']);
    form.reset();
    await el.updateComplete;
    await expect(el.files).toEqual([]);
    await expect(new FormData(form).getAll('artefacts')).toEqual([]);
    await expect(form.checkValidity()).toBe(false);
  },
};

export const FieldsetDisabled: Story = {
  name: 'Form: disabled by a fieldset',
  render: () => html`<form style="max-width:480px"><fieldset disabled style="border:0;padding:0;margin:0">
    <legend style="font:var(--text-label);color:var(--mm-text-2);margin-bottom:var(--space-2)">Schedule step: seed data</legend>
    <mm-file-drop name="seeds" label="CSV seeds" accept=".csv" multiple></mm-file-drop>
  </fieldset></form>`,
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('mm-file-drop')!;
    await el.updateComplete;
    await expect(browseBtn(el)).toBeDisabled();
    drop(el).dispatchEvent(new DragEvent('drop', { dataTransfer: dataTransfer(seed()), bubbles: true, cancelable: true }));
    await el.updateComplete;
    await expect(el.files).toEqual([]);
    await expect(new FormData(canvasElement.querySelector('form')!).getAll('seeds')).toEqual([]);
  },
};
