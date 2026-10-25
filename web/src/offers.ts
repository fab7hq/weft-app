// What sealed work offers (17.11–17.17): each offer is its own act on the
// unit, asked of the machine; what it types is the machine's to say.

export type Offer = 'keep_rule' | 'follow_up' | 'undo';

/** A rule as the work's agent drafted it. */
export interface Drafted {
  name: string;
  rule: string;
  when: string;
  family: string;
}

/** The act an offer asks for. Keep a rule's opening has the agent draft one. */
export function offerMessage(project: string, unit: string, offer: 'keep_rule' | 'undo'): Record<string, unknown> {
  return { act: offer === 'keep_rule' ? 'draft_rule' : offer, project, unit };
}

/** Keep a rule's Save: the agent's draft as the person left it, or their own
 * rule when no draft came, for the team too when asked. */
export function keepMessage(project: string, unit: string, drafted: Drafted | null, rule: string, share: boolean): Record<string, unknown> {
  const base = drafted ?? { name: '', rule: '', when: '', family: '' };
  return { act: 'keep_rule', project, unit, draft: { rule: { ...base, rule: rule.trim() }, ...(share ? { share } : {}) } };
}

/** The read of a follow-up's words for rejected work: what its Eval found. */
export function remedyRead(project: string, unit: string): Record<string, unknown> {
  return { type: 'read', what: 'remedy', project, unit };
}
