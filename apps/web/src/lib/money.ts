const usd = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD' });

export function formatMinor(minor: number | bigint | string): string {
  const amount = BigInt(minor);
  if (amount > BigInt(Number.MAX_SAFE_INTEGER) || amount < BigInt(Number.MIN_SAFE_INTEGER))
    throw new Error('INVALID_MINOR_AMOUNT');
  return usd.format(Number(amount) / 100);
}

export function formatCurrencyBinmax(minor: number | bigint | string): string {
  const amount = BigInt(minor);
  if (amount > BigInt(Number.MAX_SAFE_INTEGER) || amount < BigInt(Number.MIN_SAFE_INTEGER))
    throw new Error('INVALID_MINOR_AMOUNT');
  const val = Number(amount) / 100;
  return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function parseStakeInput(text: string): number | null {
  const match = /^(\d{1,3})(?:,(\d{1,2}))?$/.exec(text.trim());
  if (!match) return null;
  const value = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  return value >= 100 && value <= 10_000 ? value : null;
}
