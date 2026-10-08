/**
 * Gera um UUID v4 de forma resiliente tanto em contextos seguros (HTTPS, localhost)
 * quanto em contextos não seguros (HTTP via IP público, ex: http://169.58.159.77/).
 *
 * Em navegadores modernos sob HTTP não seguro, `crypto.randomUUID` é undefined por especificação W3C.
 * Esta função utiliza fallback hierárquico:
 * 1. crypto.randomUUID() se disponível
 * 2. crypto.getRandomValues() (CSPRNG padronizado e disponível mesmo em HTTP)
 * 3. Fallback determinístico baseado em timestamp/performance para ambientes sem crypto
 */
export function safeRandomUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // Versão 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variante RFC 4122
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  const now = Date.now();
  const perf = typeof performance !== 'undefined' ? Math.floor(performance.now() * 1000) : 12345;
  const hex32 = ((BigInt(now) << 32n) ^ BigInt(perf)).toString(16).padStart(32, '0').slice(-32);
  return `${hex32.slice(0, 8)}-${hex32.slice(8, 12)}-4${hex32.slice(13, 16)}-a${hex32.slice(17, 20)}-${hex32.slice(20, 32)}`;
}
