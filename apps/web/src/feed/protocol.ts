export type Tick = { type: 'tick'; symbol: string; sequence: number; ts: string;
  price: string; hash?: string };

export type TickAction = 'apply' | 'duplicate' | 'gap';
export function tickAction(lastSequence: number, incoming: number): TickAction {
  if (!Number.isSafeInteger(incoming) || incoming < 1) return 'gap';
  if (incoming <= lastSequence) return 'duplicate';
  return incoming === lastSequence + 1 ? 'apply' : 'gap';
}
