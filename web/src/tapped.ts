// What a tapped notification opens (web-app.md §8). The tag says, since
// Safari ignores a notification's data: an agent's id, or `seal:` or `eval:`
// with the unit of work and the Eval that closed.

export type Tapped =
  | { open: 'agent'; agent: string }
  | { open: 'seal' | 'eval'; unit: string; eval: string };

export function tapped(tag: string): Tapped {
  const [open, unit, eval_] = tag.split(':');
  if ((open === 'seal' || open === 'eval') && unit && eval_) return { open, unit, eval: eval_ };
  return { open: 'agent', agent: tag };
}
