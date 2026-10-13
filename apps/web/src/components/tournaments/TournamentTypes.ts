export type TournamentStatus = 'AO_VIVO' | 'EM_BREVE' | 'ENCERRADO';

export type TournamentTrophyVariant = 'gold-matrix' | 'silver' | 'bronze' | 'mono-gray';

export type TournamentActionType = 'participar' | 'detalhes' | 'resultado';

export interface TournamentRuleItem {
  period: string;
  deposit: string;
  assets: string;
  criteria: string;
  minOps: string;
}

export interface LeaderboardTrader {
  rank: number;
  name: string;
  country: string;
  returnPct: string;
  ops: number;
}

export interface PrizePosition {
  position: string;
  prize: string;
  isGift?: boolean;
}

export interface TournamentItem {
  id: string;
  name: string;
  subtitle: string;
  status: TournamentStatus;
  timeRemaining: string;
  timerClock: string;
  prizeFormatted: string;
  participants: number;
  participantsFormatted: string;
  trophyVariant: TournamentTrophyVariant;
  actionType: TournamentActionType;
  actionLabel: string;
  description: string;
  rules: TournamentRuleItem;
  leaderboard: LeaderboardTrader[];
  prizes: PrizePosition[];
}

export interface TournamentModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTournamentId?: string;
  initialView?: 'list' | 'details';
}
