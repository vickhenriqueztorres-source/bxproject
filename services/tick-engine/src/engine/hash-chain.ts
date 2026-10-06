import { createHash } from "node:crypto";

export class HashChain {
  public static computeGenesisHash(symbol: string): string {
    return createHash("sha256")
      .update(`genesis|${symbol}`, "utf8")
      .digest("hex");
  }

  public static computeTickHash(
    prevHash: string,
    symbol: string,
    sequence: bigint,
    ts: Date,
    price: string
  ): string {
    // Serialização canônica determinística: prevHash|symbol|sequence|ts_iso|price
    const canonicalString = `${prevHash}|${symbol}|${sequence.toString()}|${ts.toISOString()}|${price}`;
    return createHash("sha256")
      .update(canonicalString, "utf8")
      .digest("hex");
  }
}
