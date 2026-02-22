'use client';

import { useState, useMemo, useRef, useCallback } from 'react';
import { Table, Tabs, Select, Group, ActionIcon, Text, Collapse } from '@mantine/core';
import { IconChevronDown, IconChevronUp, IconArrowsSort, IconCopy, IconCheck, IconMaximize, IconMinimize } from '@tabler/icons-react';
import { TreeNode, actionLabels, streetLabels, Street } from '@/types';

interface Leak {
  nodeId: string;
  path: string;
  player: 'OOP' | 'IP';
  type: 'overfold' | 'underfold' | 'overbluff' | 'underbluff' | 'float';
  frequency: number;
  gtoFrequency: number;
  diff: number;
  reach: number;
  street: Street;
  potSize: number;
  combos: number;
  relDiff: number;
  floatEV?: number;
}

interface Exploit {
  nodeId: string;
  path: string;
  player: 'OOP' | 'IP';
  type: 'missed-exploit-call' | 'missed-exploit-bet' | 'exploiting-call' | 'exploiting-bet';
  frequency: number;
  gtoFrequency: number;
  diff: number;
  reach: number;
  street: Street;
  potSize: number;
  combos: number;
  relDiff: number;
}

interface LeaksTableProps {
  tree: TreeNode;
  initialPotSize: number;
  initialOopCombos: number;
  initialIpCombos: number;
  visible: boolean;
  onToggleVisible: () => void;
  onLeakClick?: (nodeId: string) => void;
  hideRootFromLine?: boolean;
}

type SortField = 'type' | 'street' | 'potSize' | 'reach' | 'diff' | 'combos' | 'relDiff';
type SortDirection = 'asc' | 'desc';

// Calculate pot after an action
function calculatePot(
  action: string,
  pot: number,
  facingBet: number,
  sizing?: number
): { newPot: number; newFacingBet: number } {
  switch (action) {
    case 'bet': {
      const betAmount = pot * (sizing || 50) / 100;
      return { newPot: pot + betAmount, newFacingBet: betAmount };
    }
    case 'raise': {
      const multiplier = sizing || 3;
      const raiseTotal = multiplier * facingBet;
      const newFacing = raiseTotal - facingBet;
      return { newPot: pot + raiseTotal, newFacingBet: newFacing };
    }
    case 'call': {
      return { newPot: pot + facingBet, newFacingBet: 0 };
    }
    case 'check':
    case 'fold':
    default:
      return { newPot: pot, newFacingBet: 0 };
  }
}

type PathSegment = { street: string; actions: string[] };

function addToPath(path: PathSegment[], street: string, action: string): PathSegment[] {
  if (path.length > 0 && path[path.length - 1].street === street) {
    const last = path[path.length - 1];
    return [...path.slice(0, -1), { street, actions: [...last.actions, action] }];
  }
  return [...path, { street, actions: [action] }];
}

function formatPath(path: PathSegment[]): string {
  return path.map(seg => seg.actions.join('')).join(' → ');
}

function findLeaks(
  node: TreeNode,
  initialPotSize: number,
  initialOopCombos: number,
  initialIpCombos: number,
  oopPath: PathSegment[] = [],
  ipPath: PathSegment[] = [],
  parentReach: number = 1,
  pot: number = initialPotSize,
  facingBet: number = 0,
  parentOopCombos: number = initialOopCombos,
  parentIpCombos: number = initialIpCombos,
  isRoot = true,
  hideRootFromLine = false
): Leak[] {
  const leaks: Leak[] = [];

  const reach = parentReach;
  const childReach = parentReach * node.frequency;

  const oopCombos = node.player === 'OOP' ? parentOopCombos * node.frequency : parentOopCombos;
  const ipCombos = node.player === 'IP' ? parentIpCombos * node.frequency : parentIpCombos;
  const actingCombos = node.player === 'OOP' ? oopCombos : ipCombos;

  const { newPot, newFacingBet } = calculatePot(node.action, pot, facingBet, node.sizing);

  const nodeLabel = actionLabels[node.action];
  const hasSizing = (node.action === 'bet' || node.action === 'raise') && node.sizing !== undefined;
  const callSizing = node.action === 'call' && facingBet > 0 && pot > facingBet
    ? Math.round(facingBet / (pot - facingBet) * 100)
    : undefined;
  const nodeDisplayLabel = hasSizing
    ? node.action === 'raise' ? `${nodeLabel}${node.sizing}X` : `${nodeLabel}${node.sizing}`
    : callSizing !== undefined ? `${nodeLabel}${callSizing}`
    : nodeLabel;

  const includeInPath = !(isRoot && hideRootFromLine);
  const newOopPath = node.player === 'OOP' && includeInPath
    ? addToPath(oopPath, node.street, nodeDisplayLabel)
    : oopPath;
  const newIpPath = node.player === 'IP' && includeInPath
    ? addToPath(ipPath, node.street, nodeDisplayLabel)
    : ipPath;

  // Check for fold leaks
  if (node.action === 'fold') {
    const playerPath = node.player === 'OOP' ? newOopPath : newIpPath;
    if (node.frequency > node.gtoFrequency) {
      leaks.push({
        nodeId: node.id,
        path: formatPath(playerPath),
        player: node.player,
        type: 'overfold',
        frequency: node.frequency,
        gtoFrequency: node.gtoFrequency,
        diff: node.frequency - node.gtoFrequency,
        reach,
        street: node.street,
        potSize: newPot,
        combos: actingCombos,
        relDiff: node.gtoFrequency > 0 ? (node.frequency - node.gtoFrequency) / node.gtoFrequency : 0,
      });
    } else if (node.frequency < node.gtoFrequency) {
      leaks.push({
        nodeId: node.id,
        path: formatPath(playerPath),
        player: node.player,
        type: 'underfold',
        frequency: node.frequency,
        gtoFrequency: node.gtoFrequency,
        diff: node.gtoFrequency - node.frequency,
        reach,
        street: node.street,
        potSize: newPot,
        combos: actingCombos,
        relDiff: node.gtoFrequency > 0 ? (node.gtoFrequency - node.frequency) / node.gtoFrequency : 0,
      });
    }
  }

  // Check for overbluffs/underbluffs
  if ((node.action === 'bet' || node.action === 'raise') &&
      node.weakPercent !== undefined &&
      node.gtoWeakPercent !== undefined &&
      node.weakPercent !== node.gtoWeakPercent) {
    const playerPath = node.player === 'OOP' ? newOopPath : newIpPath;
    const isOver = node.weakPercent > node.gtoWeakPercent;
    leaks.push({
      nodeId: node.id,
      path: formatPath(playerPath),
      player: node.player,
      type: isOver ? 'overbluff' : 'underbluff',
      frequency: node.weakPercent,
      gtoFrequency: node.gtoWeakPercent,
      diff: Math.abs(node.weakPercent - node.gtoWeakPercent),
      reach,
      street: node.street,
      potSize: newPot,
      combos: actingCombos,
      relDiff: node.gtoWeakPercent > 0 ? Math.abs(node.weakPercent - node.gtoWeakPercent) / node.gtoWeakPercent : 0,
    });
  }

  // Check for float opportunities at call nodes (leak belongs to the opponent who check-folds too much)
  if (node.action === 'call') {
    const callAmount = facingBet;
    const callPot = newPot;
    const callerPlayer = node.player;
    const opponentPlayer = callerPlayer === 'OOP' ? 'IP' : 'OOP';
    const opponentPath = opponentPlayer === 'OOP' ? newOopPath : newIpPath;
    const opponentCombos = opponentPlayer === 'OOP' ? oopCombos : ipCombos;

    let bestFloatEV: number | undefined;
    for (const checkChild of node.children) {
      if (checkChild.action !== 'check') continue;
      const checkFreq = checkChild.frequency;
      for (const betChild of checkChild.children) {
        if (betChild.player !== callerPlayer || betChild.action !== 'bet') continue;
        const betAmount = callPot * (betChild.sizing || 50) / 100;
        for (const foldChild of betChild.children) {
          if (foldChild.action !== 'fold' || foldChild.player === callerPlayer) continue;
          const foldFreq = foldChild.frequency;
          const floatEV = checkFreq * (foldFreq * callPot - (1 - foldFreq) * betAmount) - callAmount;
          if (floatEV > 0 && (bestFloatEV === undefined || floatEV > bestFloatEV)) {
            bestFloatEV = floatEV;
          }
        }
      }
    }

    if (bestFloatEV !== undefined) {
      leaks.push({
        nodeId: node.id,
        path: formatPath(opponentPath),
        player: opponentPlayer,
        type: 'float',
        frequency: 0,
        gtoFrequency: 0,
        diff: bestFloatEV,
        reach,
        street: node.street,
        potSize: callPot,
        combos: opponentCombos,
        relDiff: 0,
        floatEV: bestFloatEV,
      });
    }
  }

  for (const child of node.children) {
    leaks.push(...findLeaks(child, initialPotSize, initialOopCombos, initialIpCombos, newOopPath, newIpPath, childReach, newPot, newFacingBet, oopCombos, ipCombos, false, hideRootFromLine));
  }

  return leaks;
}

function findExploits(
  node: TreeNode,
  initialPotSize: number,
  initialOopCombos: number,
  initialIpCombos: number,
  oopPath: PathSegment[] = [],
  ipPath: PathSegment[] = [],
  parentReach: number = 1,
  pot: number = initialPotSize,
  facingBet: number = 0,
  parentOopCombos: number = initialOopCombos,
  parentIpCombos: number = initialIpCombos,
  isRoot = true,
  hideRootFromLine = false,
  opponentOverbluffs: { OOP: boolean; IP: boolean } = { OOP: false, IP: false }
): Exploit[] {
  const exploits: Exploit[] = [];

  const reach = parentReach;
  const childReach = parentReach * node.frequency;

  const oopCombos = node.player === 'OOP' ? parentOopCombos * node.frequency : parentOopCombos;
  const ipCombos = node.player === 'IP' ? parentIpCombos * node.frequency : parentIpCombos;
  const actingCombos = node.player === 'OOP' ? oopCombos : ipCombos;

  const { newPot, newFacingBet } = calculatePot(node.action, pot, facingBet, node.sizing);

  const nodeLabel = actionLabels[node.action];
  const hasSizing = (node.action === 'bet' || node.action === 'raise') && node.sizing !== undefined;
  const callSizing = node.action === 'call' && facingBet > 0 && pot > facingBet
    ? Math.round(facingBet / (pot - facingBet) * 100)
    : undefined;
  const nodeDisplayLabel = hasSizing
    ? node.action === 'raise' ? `${nodeLabel}${node.sizing}X` : `${nodeLabel}${node.sizing}`
    : callSizing !== undefined ? `${nodeLabel}${callSizing}`
    : nodeLabel;

  const includeInPath = !(isRoot && hideRootFromLine);
  const newOopPath = node.player === 'OOP' && includeInPath
    ? addToPath(oopPath, node.street, nodeDisplayLabel)
    : oopPath;
  const newIpPath = node.player === 'IP' && includeInPath
    ? addToPath(ipPath, node.street, nodeDisplayLabel)
    : ipPath;
  const playerPath = node.player === 'OOP' ? newOopPath : newIpPath;

  const isOverbluff = (node.action === 'bet' || node.action === 'raise') &&
    node.weakPercent !== undefined &&
    node.gtoWeakPercent !== undefined &&
    node.weakPercent > node.gtoWeakPercent;

  const newOverbluffs = {
    ...opponentOverbluffs,
    [node.player]: opponentOverbluffs[node.player as 'OOP' | 'IP'] || isOverbluff,
  };

  const opponent = node.player === 'OOP' ? 'IP' : 'OOP';
  const opponentHasOverbluffed = opponentOverbluffs[opponent];

  // Missed exploit (call): overfolding when opponent overbluffs — should be calling more
  if (node.action === 'fold' && node.frequency > node.gtoFrequency && opponentHasOverbluffed) {
    exploits.push({
      nodeId: node.id,
      path: formatPath(playerPath),
      player: node.player,
      type: 'missed-exploit-call',
      frequency: node.frequency,
      gtoFrequency: node.gtoFrequency,
      diff: node.frequency - node.gtoFrequency,
      reach,
      street: node.street,
      potSize: newPot,
      combos: actingCombos,
      relDiff: node.gtoFrequency > 0 ? (node.frequency - node.gtoFrequency) / node.gtoFrequency : 0,
    });
  }

  // Missed exploit (bet): betting less than GTO when opponent overfoldsm — should be betting more
  if ((node.action === 'bet' || node.action === 'raise') && node.frequency < node.gtoFrequency) {
    const opponentOverfolds = node.children.some(child =>
      child.action === 'fold' && child.player !== node.player && child.frequency > child.gtoFrequency
    );
    if (opponentOverfolds) {
      exploits.push({
        nodeId: node.id,
        path: formatPath(playerPath),
        player: node.player,
        type: 'missed-exploit-bet',
        frequency: node.frequency,
        gtoFrequency: node.gtoFrequency,
        diff: node.gtoFrequency - node.frequency,
        reach,
        street: node.street,
        potSize: newPot,
        combos: actingCombos,
        relDiff: node.gtoFrequency > 0 ? (node.gtoFrequency - node.frequency) / node.gtoFrequency : 0,
      });
    }
  }

  // Exploiting call: underfold (calling more) when opponent overbluffs
  if (node.action === 'fold' && node.frequency < node.gtoFrequency && opponentHasOverbluffed) {
    exploits.push({
      nodeId: node.id,
      path: formatPath(playerPath),
      player: node.player,
      type: 'exploiting-call',
      frequency: node.frequency,
      gtoFrequency: node.gtoFrequency,
      diff: node.gtoFrequency - node.frequency,
      reach,
      street: node.street,
      potSize: newPot,
      combos: actingCombos,
      relDiff: node.gtoFrequency > 0 ? (node.gtoFrequency - node.frequency) / node.gtoFrequency : 0,
    });
  }

  // Exploiting call: overcalling when opponent overbluffs
  if (node.action === 'call' && node.frequency > node.gtoFrequency && opponentHasOverbluffed) {
    exploits.push({
      nodeId: node.id,
      path: formatPath(playerPath),
      player: node.player,
      type: 'exploiting-call',
      frequency: node.frequency,
      gtoFrequency: node.gtoFrequency,
      diff: node.frequency - node.gtoFrequency,
      reach,
      street: node.street,
      potSize: newPot,
      combos: actingCombos,
      relDiff: node.gtoFrequency > 0 ? (node.frequency - node.gtoFrequency) / node.gtoFrequency : 0,
    });
  }

  // Exploiting bet: betting more than GTO into opponent's overfold
  if ((node.action === 'bet' || node.action === 'raise') && node.frequency > node.gtoFrequency) {
    const opponentOverfolds = node.children.some(child =>
      child.action === 'fold' && child.player !== node.player && child.frequency > child.gtoFrequency
    );
    if (opponentOverfolds) {
      exploits.push({
        nodeId: node.id,
        path: formatPath(playerPath),
        player: node.player,
        type: 'exploiting-bet',
        frequency: node.frequency,
        gtoFrequency: node.gtoFrequency,
        diff: node.frequency - node.gtoFrequency,
        reach,
        street: node.street,
        potSize: newPot,
        combos: actingCombos,
        relDiff: node.gtoFrequency > 0 ? (node.frequency - node.gtoFrequency) / node.gtoFrequency : 0,
      });
    }
  }

  for (const child of node.children) {
    exploits.push(...findExploits(
      child, initialPotSize, initialOopCombos, initialIpCombos,
      newOopPath, newIpPath, childReach, newPot, newFacingBet,
      oopCombos, ipCombos, false, hideRootFromLine, newOverbluffs
    ));
  }

  return exploits;
}

type ActionPattern = 'stab' | 'donk' | 'probe';

function buildNodeAndParentMaps(
  node: TreeNode,
  parent: TreeNode | null,
  nodeMap: Map<string, TreeNode>,
  parentMap: Map<string, TreeNode | null>,
): void {
  nodeMap.set(node.id, node);
  parentMap.set(node.id, parent);
  for (const child of node.children) {
    buildNodeAndParentMaps(child, node, nodeMap, parentMap);
  }
}

// Walk up the ancestor chain to find who made the last bet/raise.
function getLastAggressor(
  startId: string,
  nodeMap: Map<string, TreeNode>,
  parentMap: Map<string, TreeNode | null>,
): 'OOP' | 'IP' | null {
  let id: string | undefined = startId;
  while (id) {
    const node = nodeMap.get(id);
    if (!node) break;
    if (node.action === 'bet' || node.action === 'raise') return node.player;
    id = parentMap.get(id)?.id;
  }
  return null;
}

// Returns the action pattern of the bet/raise associated with this node.
// For bet/raise nodes, checks the node itself. For fold/call nodes, checks
// the parent bet/raise that prompted the response.
function getActionPattern(
  nodeId: string,
  nodeMap: Map<string, TreeNode>,
  parentMap: Map<string, TreeNode | null>,
): ActionPattern | null {
  const node = nodeMap.get(nodeId);
  if (!node) return null;

  let betNode: TreeNode | null = null;
  let betParent: TreeNode | null = null;

  if (node.action === 'bet' || node.action === 'raise') {
    betNode = node;
    betParent = parentMap.get(node.id) ?? null;
  } else if (node.action === 'fold' || node.action === 'call') {
    const parent = parentMap.get(node.id) ?? null;
    if (parent && (parent.action === 'bet' || parent.action === 'raise')) {
      betNode = parent;
      betParent = parentMap.get(parent.id) ?? null;
    }
  }

  if (!betNode || !betParent) return null;

  // Stab: IP bets when OOP checks to them AND IP was not the last aggressor
  // (i.e. aggression is changing hands to IP, not a c-bet)
  if (betNode.player === 'IP' && betParent.action === 'check' && betParent.player === 'OOP') {
    const lastAggressor = getLastAggressor(betParent.id, nodeMap, parentMap);
    if (lastAggressor !== 'IP') return 'stab';
    return null; // IP was already the aggressor → c-bet, not a stab
  }
  // Probe: OOP bets after IP checks back
  if (betNode.player === 'OOP' && betParent.action === 'check' && betParent.player === 'IP') {
    return 'probe';
  }
  // Donk: player bets/raises after calling opponent's bet/raise
  if (betParent.action === 'call' && betParent.player === betNode.player) {
    return 'donk';
  }

  return null;
}

const DEFAULT_HEIGHT = 280;
const MIN_HEIGHT = 100;
const MAX_HEIGHT = 600;

export function LeaksTable({ tree, initialPotSize, initialOopCombos, initialIpCombos, visible, onToggleVisible, onLeakClick, hideRootFromLine = false }: LeaksTableProps) {
  const [activeTab, setActiveTab] = useState<string | null>('oop');
  const [sortField, setSortField] = useState<SortField>('relDiff');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [exploitTypeFilter, setExploitTypeFilter] = useState<string | null>(null);
  const [streetFilter, setStreetFilter] = useState<string | null>(null);
  const [patternFilter, setPatternFilter] = useState<string | null>(null);
  const [panelHeight, setPanelHeight] = useState(DEFAULT_HEIGHT);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const dragStartY = useRef<number>(0);
  const dragStartHeight = useRef<number>(DEFAULT_HEIGHT);

  const isExploitTab = activeTab === 'oop-exploits' || activeTab === 'ip-exploits';

  const handleResizeStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    dragStartY.current = e.clientY;
    dragStartHeight.current = panelHeight;

    const onMove = (ev: PointerEvent) => {
      const delta = dragStartY.current - ev.clientY;
      const newHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, dragStartHeight.current + delta));
      setPanelHeight(newHeight);
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [panelHeight]);

  const handleCopy = useCallback((leaks: Leak[]) => {
    const headers = ['Type', 'Street', 'Line', 'Pot (BB)', 'Reach %', 'Combos', 'Actual %', 'GTO %', 'Diff %', 'Rel. Diff %'];
    const rows = leaks.map(l => [
      l.type === 'overfold' ? 'Overfold' : l.type === 'underfold' ? 'Underfold' : l.type === 'overbluff' ? 'Overbluff' : l.type === 'underbluff' ? 'Underbluff' : 'Float',
      streetLabels[l.street],
      l.path,
      l.potSize.toFixed(1),
      (l.reach * 100).toFixed(1),
      l.combos.toFixed(1),
      l.type === 'float' ? '-' : Math.round(l.frequency * 100).toString(),
      l.type === 'float' ? '-' : Math.round(l.gtoFrequency * 100).toString(),
      l.type === 'float' ? `+${l.floatEV!.toFixed(2)} BB` : `${l.type === 'overfold' || l.type === 'overbluff' ? '+' : '-'}${Math.round(l.diff * 100)}%`,
      l.type === 'float' ? '-' : Math.round(l.relDiff * 100).toString(),
    ]);
    const tsv = [headers, ...rows].map(r => r.join('\t')).join('\n');
    navigator.clipboard.writeText(tsv).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  const handleCopyExploits = useCallback((exploits: Exploit[]) => {
    const headers = ['Type', 'Street', 'Line', 'Pot (BB)', 'Reach %', 'Combos', 'Actual %', 'GTO %', 'Diff %', 'Rel. Diff %'];
    const rows = exploits.map(e => [
      e.type === 'missed-exploit-call' ? 'Missed (Call)' : e.type === 'missed-exploit-bet' ? 'Missed (Bet)' : e.type === 'exploiting-call' ? 'Exploit (Call)' : 'Exploit (Bet)',
      streetLabels[e.street],
      e.path,
      e.potSize.toFixed(1),
      (e.reach * 100).toFixed(1),
      e.combos.toFixed(1),
      Math.round(e.frequency * 100).toString(),
      Math.round(e.gtoFrequency * 100).toString(),
      `${e.type === 'missed-exploit' ? '+' : '+'}${Math.round(e.diff * 100)}%`,
      Math.round(e.relDiff * 100).toString(),
    ]);
    const tsv = [headers, ...rows].map(r => r.join('\t')).join('\n');
    navigator.clipboard.writeText(tsv).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  const allLeaks = useMemo(() => findLeaks(tree, initialPotSize, initialOopCombos, initialIpCombos, [], [], 1, initialPotSize, 0, initialOopCombos, initialIpCombos, true, hideRootFromLine), [tree, initialPotSize, initialOopCombos, initialIpCombos, hideRootFromLine]);

  const allExploits = useMemo(() => findExploits(tree, initialPotSize, initialOopCombos, initialIpCombos, [], [], 1, initialPotSize, 0, initialOopCombos, initialIpCombos, true, hideRootFromLine), [tree, initialPotSize, initialOopCombos, initialIpCombos, hideRootFromLine]);

  const { nodeMap, parentMap } = useMemo(() => {
    const nodeMap = new Map<string, TreeNode>();
    const parentMap = new Map<string, TreeNode | null>();
    buildNodeAndParentMaps(tree, null, nodeMap, parentMap);
    return { nodeMap, parentMap };
  }, [tree]);

  const filterAndSortLeaks = (leaks: Leak[]) => {
    let filtered = leaks;
    if (typeFilter) filtered = filtered.filter(l => l.type === typeFilter);
    if (streetFilter) filtered = filtered.filter(l => l.street === streetFilter);
    if (patternFilter) filtered = filtered.filter(l => getActionPattern(l.nodeId, nodeMap, parentMap) === patternFilter);
    return filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'type': comparison = a.type.localeCompare(b.type); break;
        case 'street': { const o = { flop: 0, turn: 1, river: 2 }; comparison = o[a.street] - o[b.street]; break; }
        case 'potSize': comparison = a.potSize - b.potSize; break;
        case 'reach': comparison = a.reach - b.reach; break;
        case 'diff': comparison = a.diff - b.diff; break;
        case 'combos': comparison = a.combos - b.combos; break;
        case 'relDiff': comparison = a.relDiff - b.relDiff; break;
      }
      return sortDirection === 'desc' ? -comparison : comparison;
    });
  };

  const filterAndSortExploits = (exploits: Exploit[]) => {
    let filtered = exploits;
    if (exploitTypeFilter) filtered = filtered.filter(e => e.type === exploitTypeFilter);
    if (streetFilter) filtered = filtered.filter(e => e.street === streetFilter);
    if (patternFilter) filtered = filtered.filter(e => getActionPattern(e.nodeId, nodeMap, parentMap) === patternFilter);
    return filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'type': comparison = a.type.localeCompare(b.type); break;
        case 'street': { const o = { flop: 0, turn: 1, river: 2 }; comparison = o[a.street] - o[b.street]; break; }
        case 'potSize': comparison = a.potSize - b.potSize; break;
        case 'reach': comparison = a.reach - b.reach; break;
        case 'diff': comparison = a.diff - b.diff; break;
        case 'combos': comparison = a.combos - b.combos; break;
        case 'relDiff': comparison = a.relDiff - b.relDiff; break;
      }
      return sortDirection === 'desc' ? -comparison : comparison;
    });
  };

  const oopLeaks = filterAndSortLeaks(allLeaks.filter(l => l.player === 'OOP'));
  const ipLeaks = filterAndSortLeaks(allLeaks.filter(l => l.player === 'IP'));
  const oopExploits = filterAndSortExploits(allExploits.filter(e => e.player === 'OOP'));
  const ipExploits = filterAndSortExploits(allExploits.filter(e => e.player === 'IP'));

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <Table.Th onClick={() => handleSort(field)} style={{ cursor: 'pointer', userSelect: 'none' }}>
      <Group gap={4} wrap="nowrap">
        {children}
        {sortField === field ? (
          sortDirection === 'desc' ? <IconChevronDown size={14} /> : <IconChevronUp size={14} />
        ) : (
          <IconArrowsSort size={14} style={{ opacity: 0.3 }} />
        )}
      </Group>
    </Table.Th>
  );

  const renderLeakLine = (path: string) => path.split(' → ').map((part, j, arr) => (
    <span key={j}>{part}{j < arr.length - 1 && <span className="leak-arrow"> → </span>}</span>
  ));

  const renderTable = (leaks: Leak[]) => {
    if (leaks.length === 0) return <div className="leaks-table-empty">No leaks detected</div>;
    return (
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <SortableHeader field="type">Type</SortableHeader>
            <SortableHeader field="street">Street</SortableHeader>
            <Table.Th>Line</Table.Th>
            <SortableHeader field="potSize">Pot</SortableHeader>
            <SortableHeader field="reach">Reach</SortableHeader>
            <SortableHeader field="combos">Combos</SortableHeader>
            <Table.Th>Actual</Table.Th>
            <Table.Th>GTO</Table.Th>
            <SortableHeader field="diff">Diff</SortableHeader>
            <SortableHeader field="relDiff">Rel. Diff</SortableHeader>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {leaks.map((leak, i) => (
            <Table.Tr key={i} onClick={() => onLeakClick?.(leak.nodeId)} style={onLeakClick ? { cursor: 'pointer' } : undefined}>
              <Table.Td className={`leak-type-${leak.type}`}>
                {leak.type === 'overfold' ? 'Overfold' : leak.type === 'underfold' ? 'Underfold' : leak.type === 'overbluff' ? 'Overbluff' : leak.type === 'underbluff' ? 'Underbluff' : 'Float'}
              </Table.Td>
              <Table.Td><span className={`street-pill ${leak.street}`}>{streetLabels[leak.street]}</span></Table.Td>
              <Table.Td className="leak-line">{renderLeakLine(leak.path)}</Table.Td>
              <Table.Td>{leak.potSize.toFixed(1)} BB</Table.Td>
              <Table.Td>{(leak.reach * 100).toFixed(1)}%</Table.Td>
              <Table.Td>{leak.combos.toFixed(1)}</Table.Td>
              <Table.Td>{leak.type === 'float' ? '—' : `${Math.round(leak.frequency * 100)}%`}</Table.Td>
              <Table.Td>{leak.type === 'float' ? '—' : `${Math.round(leak.gtoFrequency * 100)}%`}</Table.Td>
              <Table.Td className={`leak-type-${leak.type}`}>
                {leak.type === 'float' ? `+${leak.floatEV!.toFixed(1)} BB` : `${leak.type === 'overfold' || leak.type === 'overbluff' ? '+' : '-'}${Math.round(leak.diff * 100)}%`}
              </Table.Td>
              <Table.Td>{leak.type === 'float' ? '—' : `${Math.round(leak.relDiff * 100)}%`}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    );
  };

  const renderExploitTable = (exploits: Exploit[]) => {
    if (exploits.length === 0) return <div className="leaks-table-empty">No exploits detected</div>;
    return (
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <SortableHeader field="type">Type</SortableHeader>
            <SortableHeader field="street">Street</SortableHeader>
            <Table.Th>Line</Table.Th>
            <SortableHeader field="potSize">Pot</SortableHeader>
            <SortableHeader field="reach">Reach</SortableHeader>
            <SortableHeader field="combos">Combos</SortableHeader>
            <Table.Th>Actual</Table.Th>
            <Table.Th>GTO</Table.Th>
            <SortableHeader field="diff">Diff</SortableHeader>
            <SortableHeader field="relDiff">Rel. Diff</SortableHeader>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {exploits.map((exploit, i) => (
            <Table.Tr key={i} onClick={() => onLeakClick?.(exploit.nodeId)} style={onLeakClick ? { cursor: 'pointer' } : undefined}>
              <Table.Td className={`exploit-type-${exploit.type}`}>
                {exploit.type === 'missed-exploit-call' ? 'Missed (Call)' : exploit.type === 'missed-exploit-bet' ? 'Missed (Bet)' : exploit.type === 'exploiting-call' ? 'Exploit (Call)' : 'Exploit (Bet)'}
              </Table.Td>
              <Table.Td><span className={`street-pill ${exploit.street}`}>{streetLabels[exploit.street]}</span></Table.Td>
              <Table.Td className="leak-line">{renderLeakLine(exploit.path)}</Table.Td>
              <Table.Td>{exploit.potSize.toFixed(1)} BB</Table.Td>
              <Table.Td>{(exploit.reach * 100).toFixed(1)}%</Table.Td>
              <Table.Td>{exploit.combos.toFixed(1)}</Table.Td>
              <Table.Td>{Math.round(exploit.frequency * 100)}%</Table.Td>
              <Table.Td>{Math.round(exploit.gtoFrequency * 100)}%</Table.Td>
              <Table.Td className={`exploit-type-${exploit.type}`}>
                {exploit.type === 'missed-exploit' ? '+' : '+'}{Math.round(exploit.diff * 100)}%
              </Table.Td>
              <Table.Td>{Math.round(exploit.relDiff * 100)}%</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    );
  };

  const totalLeaks = allLeaks.length;
  const totalExploits = allExploits.length;

  const activeCopyData = activeTab === 'ip' ? ipLeaks
    : activeTab === 'oop-exploits' ? oopExploits
    : activeTab === 'ip-exploits' ? ipExploits
    : oopLeaks;

  const fullscreenStyle: React.CSSProperties = isFullscreen
    ? { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, height: '100vh', zIndex: 200 }
    : visible ? { height: panelHeight } : {};

  return (
    <div className="leaks-panel" style={fullscreenStyle}>
      {visible && !isFullscreen && <div className="leaks-resize-handle" onPointerDown={handleResizeStart} />}
      <div className="leaks-table-header-bar">
        <Group gap="sm" align="center">
          <ActionIcon variant="subtle" onClick={onToggleVisible} title={visible ? 'Hide panel' : 'Show panel'} disabled={isFullscreen}>
            {visible ? <IconChevronDown size={18} /> : <IconChevronUp size={18} />}
          </ActionIcon>
          <Text fw={600} size="sm">
            Leaks ({totalLeaks}) · Exploits ({totalExploits})
          </Text>
        </Group>
        {visible && (
          <Group gap="sm">
            {!isExploitTab ? (
              <Select
                size="xs"
                placeholder="All types"
                clearable
                value={typeFilter}
                onChange={setTypeFilter}
                data={[
                  { value: 'overfold', label: 'Overfold' },
                  { value: 'underfold', label: 'Underfold' },
                  { value: 'overbluff', label: 'Overbluff' },
                  { value: 'underbluff', label: 'Underbluff' },
                  { value: 'float', label: 'Float' },
                ]}
                w={130}
              />
            ) : (
              <Select
                size="xs"
                placeholder="All types"
                clearable
                value={exploitTypeFilter}
                onChange={setExploitTypeFilter}
                data={[
                  { value: 'missed-exploit-call', label: 'Missed (Call)' },
                  { value: 'missed-exploit-bet', label: 'Missed (Bet)' },
                  { value: 'exploiting-call', label: 'Exploit (Call)' },
                  { value: 'exploiting-bet', label: 'Exploit (Bet)' },
                ]}
                w={130}
              />
            )}
            <Select
              size="xs"
              placeholder="All patterns"
              clearable
              value={patternFilter}
              onChange={setPatternFilter}
              data={[
                { value: 'stab', label: 'Stab' },
                { value: 'donk', label: 'Donk' },
                { value: 'probe', label: 'Probe' },
              ]}
              w={120}
            />
            <Select
              size="xs"
              placeholder="All streets"
              clearable
              value={streetFilter}
              onChange={setStreetFilter}
              data={[
                { value: 'flop', label: 'Flop' },
                { value: 'turn', label: 'Turn' },
                { value: 'river', label: 'River' },
              ]}
              w={120}
            />
            <ActionIcon
              variant="subtle"
              onClick={() => isExploitTab ? handleCopyExploits(activeCopyData as Exploit[]) : handleCopy(activeCopyData as Leak[])}
              title="Copy as table (paste into Google Sheets)"
              color={copied ? 'teal' : undefined}
            >
              {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
            </ActionIcon>
            <ActionIcon
              variant="subtle"
              onClick={() => setIsFullscreen(f => !f)}
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <IconMinimize size={16} /> : <IconMaximize size={16} />}
            </ActionIcon>
          </Group>
        )}
      </div>

      <div className="leaks-table-container">
        <Collapse in={visible}>
          <Tabs value={activeTab} onChange={setActiveTab}>
            <Tabs.List>
              <Tabs.Tab value="oop">OOP Leaks ({oopLeaks.length})</Tabs.Tab>
              <Tabs.Tab value="ip">IP Leaks ({ipLeaks.length})</Tabs.Tab>
              <Tabs.Tab value="oop-exploits">OOP Exploits ({oopExploits.length})</Tabs.Tab>
              <Tabs.Tab value="ip-exploits">IP Exploits ({ipExploits.length})</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="oop" pt="sm">{renderTable(oopLeaks)}</Tabs.Panel>
            <Tabs.Panel value="ip" pt="sm">{renderTable(ipLeaks)}</Tabs.Panel>
            <Tabs.Panel value="oop-exploits" pt="sm">{renderExploitTable(oopExploits)}</Tabs.Panel>
            <Tabs.Panel value="ip-exploits" pt="sm">{renderExploitTable(ipExploits)}</Tabs.Panel>
          </Tabs>
        </Collapse>
      </div>
    </div>
  );
}
