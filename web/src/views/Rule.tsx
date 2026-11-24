/** A rule of the project, as an item or a question names it: where it is written, then its words. */
export function RuleBlock({ label, quote }: { label: string; quote: string }) {
  return (
    <div class="rule-block">
      {label && <span class="rule-block-label">{label}</span>}
      {quote && <span class="rule-block-quote">{quote}</span>}
    </div>
  );
}
