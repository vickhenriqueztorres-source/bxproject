/**
 * Symbol Sharding Router (Padrão de Resiliência para Escala Horizontal de Fan-Out)
 */
export class SymbolShardingRouter {
    numNodes;
    constructor(numNodes = 1) {
        this.numNodes = Math.max(1, Math.floor(numNodes));
    }
    static hashString(str) {
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
    getNodeIndex(symbol) {
        if (this.numNodes === 1)
            return 0;
        const hash = SymbolShardingRouter.hashString(symbol);
        return hash % this.numNodes;
    }
    getChannelForSymbol(symbol) {
        const nodeIndex = this.getNodeIndex(symbol);
        return {
            channel: `market:ticks:${symbol}`,
            nodeIndex,
        };
    }
    getNumNodes() {
        return this.numNodes;
    }
}
