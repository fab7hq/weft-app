// A file's bytes as text, and its text as lines.

export const decode = (bytes: Uint8Array): string => new TextDecoder('utf-8').decode(bytes);

/** A text's lines; a last line break starts no line of its own. */
export function linesOf(text: string): string[] {
  const lines = text.split(/\r\n|\n|\r/);
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}
