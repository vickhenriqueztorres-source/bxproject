"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayoutCalculator = void 0;
class PayoutCalculator {
    static PAYOUT_PERCENTAGE = 85;
    /**
     * Determina WIN, LOSS ou DRAW comparando exitPrice com entryPrice
     * Utiliza precisão de 6 casas decimais para evitar imprecisões de float binário
     */
    static determineResult(direction, entryPrice, exitPrice) {
        const entryScaled = BigInt(Math.round(parseFloat(entryPrice) * 1_000_000));
        const exitScaled = BigInt(Math.round(parseFloat(exitPrice) * 1_000_000));
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
        // WIN: lucro = Math.floor(stake * 85 / 100)
        const profitMinor = Math.floor((stakeMinor * payoutPercentage) / 100);
        const totalPayoutMinor = stakeMinor + profitMinor;
        return {
            result: "WIN",
            payout_minor: totalPayoutMinor,
            profit_minor: profitMinor
        };
    }
}
exports.PayoutCalculator = PayoutCalculator;
