import { describe, expect, it } from 'vitest';
import { formatMinor, parseStakeInput } from './money';

describe('[T13-UNIT] valores monetários na interface', () => {
  it('formata centavos inteiros em USD e pt-BR, inclusive valor negativo', () => {
    expect(formatMinor(1_000_000)).toMatch(/US\$\s*10\.000,00/);
    expect(formatMinor(-85)).toMatch(/-\s*US\$\s*0,85|US\$\s*-\s*0,85/);
    expect(() => formatMinor('9007199254740992')).toThrow('INVALID_MINOR_AMOUNT');
  });
  it('aceita somente centavos exatos de US$ 1 a US$ 100', () => {
    expect(parseStakeInput('1')).toBe(100);
    expect(parseStakeInput('10,5')).toBe(1050);
    expect(parseStakeInput('100,00')).toBe(10_000);
    for (const invalid of ['0,99', '100,01', '10.50', '1,234', '-1', '1e2', 'R$ 10'])
      expect(parseStakeInput(invalid)).toBeNull();
  });
});
