/**
 * Join-code generation (plan 4.3). Excludes visually-ambiguous characters
 * (0/O, 1/I) — these are read aloud or typed in by hand from a coach's
 * screen, not scanned.
 */
const JOIN_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const JOIN_CODE_LENGTH = 6;

export function generateJoinCode(): string {
  let code = '';
  for (let i = 0; i < JOIN_CODE_LENGTH; i++) {
    code += JOIN_CODE_ALPHABET[Math.floor(Math.random() * JOIN_CODE_ALPHABET.length)];
  }
  return code;
}
