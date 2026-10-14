import { describe, it } from "vitest";
import { registerTournamentBlnkArenaAuditSuite } from "./tournament-blnk-arena-audit.test.ts";

registerTournamentBlnkArenaAuditSuite(describe, (name: string, fn: () => Promise<void>) => it(name, fn, 30_000));

