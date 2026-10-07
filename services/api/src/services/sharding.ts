/**
 * Symbol Sharding Router (Padrão de Resiliência para Escala Horizontal de Fan-Out)
 */

export class SymbolShardingRouter {
  private readonly numNodes: number;

  constructor(numNodes = 1) {
    this.numNodes = Math.max(1, Math.floor(numNodes));
  }

  public static hashString(str: string): number {
    let hash = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    hash ^= hash >>> 16;
    hash = Math.imul(hash, 0x45d9f3b);
    hash ^= hash >>> 16;
    return Math.abs(hash);
  }

  public getNodeIndex(symbol: string): number {
    if (this.numNodes === 1) return 0;
    const hash = SymbolShardingRouter.hashString(symbol);
    return hash % this.numNodes;
  }

  public getChannelForSymbol(symbol: string): { channel: string; nodeIndex: number } {
    const nodeIndex = this.getNodeIndex(symbol);
    return {
      channel: `market:ticks:${symbol}`,
      nodeIndex,
    };
  }

  public getNumNodes(): number {
    return this.numNodes;
  }
}
