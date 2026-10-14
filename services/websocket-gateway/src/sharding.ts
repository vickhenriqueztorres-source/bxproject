/**
 * Symbol Sharding Router (Padrão de Resiliência para Escala Horizontal de Fan-Out)
 * 
 * Regra:
 * nodeIndex = hash(symbol) % numNodes
 * 
 * Distribui determinística e homogeneamente os canais de Pub/Sub entre N nós de mensageria
 * utilizando algoritmo FNV-1a de 32 bits com etapa de dispersão por avalanche.
 */

export class SymbolShardingRouter {
  private readonly numNodes: number;

  constructor(numNodes = 1) {
    this.numNodes = Math.max(1, Math.floor(numNodes));
  }

  /**
   * Função de Hash FNV-1a com avalanche mix para distribuição uniforme de símbolos.
   */
  public static hashString(str: string): number {
    let hash = 0x811c9dc5; // Offset basis FNV-1a
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193); // FNV prime
    }
    // Etapa de dispersão por avalanche
    hash ^= hash >>> 16;
    hash = Math.imul(hash, 0x45d9f3b);
    hash ^= hash >>> 16;
    return Math.abs(hash);
  }

  /**
   * Retorna o índice do nó (0 a numNodes - 1) para o ativo especificado.
   */
  public getNodeIndex(symbol: string): number {
    if (this.numNodes === 1) return 0;
    const hash = SymbolShardingRouter.hashString(symbol);
    return hash % this.numNodes;
  }

  /**
   * Retorna o canal e o nó de destino de forma canônica.
   */
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

  /**
   * Verifica se um símbolo pertence a este nó específico do cluster de WebSocket Gateway.
   */
  public isAssignedToNode(symbol: string, currentNodeIndex = 0): boolean {
    if (this.numNodes <= 1) return true;
    return this.getNodeIndex(symbol) === currentNodeIndex;
  }
}
