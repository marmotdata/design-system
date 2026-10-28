import CodeBlock from '@theme/CodeBlock';
import styles from './Example.module.css';

/** A live example of real Marmot components, with its markup underneath. */
export default function Example({ html, code = true, label }: { html: string; code?: boolean; label?: string }) {
  return (
    <figure className={styles.example}>
      <div className={styles.stage} role="group" aria-label={label ?? 'Example'} dangerouslySetInnerHTML={{ __html: html }} />
      {code ? <CodeBlock language="html">{html.trim()}</CodeBlock> : null}
    </figure>
  );
}
