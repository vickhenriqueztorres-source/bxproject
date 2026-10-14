"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayoutCalculator = void 0;
exports.parsePriceToMicroBigInt = parsePriceToMicroBigInt;
function parsePriceToMicroBigInt(price) {
    const trimmed = String(price ?? "").trim();
    const match = /^([+-])?(\d+)(?:\.(\d+))?$/.exec(trimmed);
    if (!match) {
        throw new Error(`INVALID_PRICE_FORMAT: Cannot parse price '${price}' to micro-units BigInt`);
    }
    const sign = match[1] === "-" ? -1n : 1n;
    const intPart = BigInt(match[2]);
    const rawFrac = match[3] || "";
    const fracSix = rawFrac.slice(0, 6).padEnd(6, "0");
    let micro = intPart * 1000000n + BigInt(fracSix);
    if (rawFrac.length > 6) {
        const seventhDigit = rawFrac.charCodeAt(6) - 48;
        if (seventhDigit >= 5) {
            micro += 1n;
        }
    }
    return sign * micro;
}
class PayoutCalculator {
    static PAYOUT_PERCENTAGE = 85;
    static parsePriceToMicroBigInt(price) {
        return parsePriceToMicroBigInt(price);
    }
    /**
     * Determina WIN, LOSS ou DRAW comparando exitPrice com entryPrice
     * Utiliza precisão de 6 casas decimais em BigInt determinístico sem ponto flutuante binário
     */
    static determineResult(direction, entryPrice, exitPrice) {
        const entryScaled = parsePriceToMicroBigInt(entryPrice);
        const exitScaled = parsePriceToMicroBigInt(exitPrice);
        if (exitScaled === entryScaled) {
            return "DRAW";
        }
        if (direction === "UP") {
            return exitScaled > entryScaled ? "WIN" : "LOSS";
        }
        else {
            return exitScaled < entryScaled ? "WIN" : "LOSS";
        }
    }
    /**
     * Calcula o payout em centavos USD inteiros (D-18, D-19)
     */
    static calculatePayout(result, stakeMinor, payoutPercentage = 85) {
        if (!Number.isSafeInteger(stakeMinor) || stakeMinor <= 0) {
            throw new Error("INVALID_MINOR_AMOUNT: stakeMinor must be positive integer");
        }
        if (result === "LOSS") {
            return {
                result: "LOSS",
                payout_minor: 0,
                profit_minor: 0
            };
        }
        if (result === "DRAW") {
            return {
                result: "DRAW",
                payout_minor: stakeMinor, // Reembolso integral da stake
                profit_minor: 0
            };
        }
        // WIN: lucro = floor(stake * 85 / 100) via BigInt inteiro
        const profitMinor = Number((BigInt(stakeMinor) * BigInt(Math.trunc(payoutPercentage))) / 100n);
        const totalPayoutMinor = stakeMinor + profitMinor;
        return {
            result: "WIN",
            payout_minor: totalPayoutMinor,
            profit_minor: profitMinor
        };
    }
}
exports.PayoutCalculator = PayoutCalculator;
