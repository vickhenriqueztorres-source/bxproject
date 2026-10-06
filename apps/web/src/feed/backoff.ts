export function reconnectDelay(attempt: number, random = Math.random): number {
  const ceiling = Math.min(30_000, 500 * 2 ** Math.min(attempt, 16));
  return 100 + Math.floor(random() * (ceiling - 100));
}
