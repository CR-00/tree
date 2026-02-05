export type Action = 'bet' | 'check' | 'raise' | 'fold' | 'call';
export type Street = 'flop' | 'turn' | 'river';
export type Player = 'OOP' | 'IP';

// Base tree node - structure only, no frequencies
export interface BaseTreeNode {
  id: string;
  action: Action;
  player: Player;
  street: Street;
  sizing?: number; // For bets: % of pot (e.g., 33, 50, 75). For raises: multiplier of facing bet (e.g., 2.5, 3, 4)
  children: BaseTreeNode[];
}

// Tree node with computed frequencies for display
export interface TreeNode extends BaseTreeNode {
  frequency: number; // 0-1 actual/player frequency
  gtoFrequency: number; // 0-1 GTO optimal frequency
  weakPercent?: number; // 0-1 bluff frequency (for B/R nodes)
  gtoWeakPercent?: number; // 0-1 GTO bluff frequency (for B/R nodes)
  children: TreeNode[];
}

export interface Spot {
  id: string;
  name: string;
  description: string;
  potSize: number; // in big blinds
  oopCombos: number; // number of combos in OOP's range at the root
  ipCombos: number; // number of combos in IP's range at the root
  tree: BaseTreeNode;
}

// Spot with processed tree (frequencies applied) for display
export interface ProcessedSpot {
  id: string;
  name: string;
  description: string;
  potSize: number; // in big blinds
  oopCombos: number;
  ipCombos: number;
  tree: TreeNode;
}

// Profile system
export interface NodeFrequencies {
  frequency: number;
  weakPercent?: number;
}

export interface Profile {
  id: string;
  name: string;
  description: string;
  player: Player;
  spotId: string;
  isGto: boolean; // true = this is the GTO baseline profile
  // Node frequencies keyed by node ID
  nodeData: Record<string, NodeFrequencies>;
}

export const actionLabels: Record<Action, string> = {
  bet: 'B',
  check: 'X',
  raise: 'R',
  fold: 'F',
  call: 'C',
};

export const streetLabels: Record<Street, string> = {
  flop: 'F',
  turn: 'T',
  river: 'R',
};
