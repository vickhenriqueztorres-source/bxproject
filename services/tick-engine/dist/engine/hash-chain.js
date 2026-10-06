"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HashChain = void 0;
const node_crypto_1 = require("node:crypto");
class HashChain {
    static computeGenesisHash(symbol) {
        return (0, node_crypto_1.createHash)("sha256")
            .update(`genesis|${symbol}`, "utf8")
            .digest("hex");
    }
    static computeTickHash(prevHash, symbol, sequence, ts, price) {
        // Serialização canônica determinística: prevHash|symbol|sequence|ts_iso|price
        const canonicalString = `${prevHash}|${symbol}|${sequence.toString()}|${ts.toISOString()}|${price}`;
        return (0, node_crypto_1.createHash)("sha256")
            .update(canonicalString, "utf8")
            .digest("hex");
    }
}
exports.HashChain = HashChain;
