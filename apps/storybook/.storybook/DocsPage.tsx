import React, { useState } from 'react';
import { Title, Subtitle, Description, Primary, Controls, Stories, Source, useOf } from '@storybook/addon-docs/blocks';

type Usage = { react?: string; svelte?: string; html?: string };

/** Usage examples for each framework, from `parameters.usage` on the component's meta. */
function UsageTabs() {
  const { preparedMeta } = useOf('meta', ['meta']) as { preparedMeta: { parameters: { usage?: Usage } } };
  const usage = preparedMeta.parameters.usage;
  const tabs = (['html', 'react', 'svelte'] as const).filter((k) => usage?.[k]);
  const [active, setActive] = useState<(typeof tabs)[number]>(tabs[0] ?? 'html');
  if (!usage || !tabs.length) return null;
  const label = { html: 'HTML', react: 'React', svelte: 'Svelte' } as const;
  const lang = { html: 'html', react: 'tsx', svelte: 'html' } as const;
  return (
    <section>
      <h2 id="usage">Usage</h2>
      <div role="tablist" aria-label="Framework" style={{ display: 'flex', gap: 20, borderBottom: '1px solid var(--mm-rule)', marginBottom: 12 }}>
        {tabs.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={t === active}
            onClick={() => setActive(t)}
            style={{
              font: 'var(--text-button)',
              color: t === active ? 'var(--mm-text)' : 'var(--mm-text-2)',
              background: 'none',
              border: 0,
              padding: '10px 2px',
              cursor: 'pointer',
              boxShadow: t === active ? 'inset 0 -2px 0 var(--mm-primary)' : 'none',
            }}
          >
            {label[t]}
          </button>
        ))}
      </div>
      <Source code={usage[active]!.trim()} language={lang[active]} dark />
    </section>
  );
}

export function DocsPage() {
  return (
    <>
      <Title />
      <Subtitle />
      <Description />
      <Primary />
      <Controls />
      <UsageTabs />
      <Stories includePrimary={false} />
    </>
  );
}
