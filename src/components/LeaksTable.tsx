'use client';

import { useState, useMemo, useRef, useCallback } from 'react';
import { Table, Tabs, Select, Group, ActionIcon, Text, Collapse } from '@mantine/core';
import { IconChevronDown, IconChevronUp, IconArrowsSort, IconCopy, IconCheck } from '@tabler/icons-react';
import { TreeNode, actionLabels, streetLabels, Street } from '@/types';

interface Leak {
  nodeId: string;
  path: string;
  player: 'OOP' | 'IP';
  type: 'overfold' | 'underfold' | 'overbluff' | 'underbluff';
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

  // Reach: how often we arrive at this decision point (excludes this node's own frequency)
  const reach = parentReach;
  const childReach = parentReach * node.frequency;

  // Calculate combos
  const oopCombos = node.player === 'OOP' ? parentOopCombos * node.frequency : parentOopCombos;
  const ipCombos = node.player === 'IP' ? parentIpCombos * node.frequency : parentIpCombos;
  const actingCombos = node.player === 'OOP' ? oopCombos : ipCombos;

  // Calculate pot after this action
  const { newPot, newFacingBet } = calculatePot(node.action, pot, facingBet, node.sizing);

  // Build sizing-aware label (matches TreeView notation)
  const nodeLabel = actionLabels[node.action];
  const hasSizing = (node.action === 'bet' || node.action === 'raise') && node.sizing !== undefined;
  const nodeDisplayLabel = hasSizing
    ? node.action === 'raise' ? `${nodeLabel}${node.sizing}X` : `${nodeLabel}${node.sizing}`
    : nodeLabel;

  // Update the appropriate player's path
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

  // Check for overbluffs/underbluffs (B/R nodes with weak% vs gtoWeak%)
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

  // Recurse into children
  for (const child of node.children) {
    leaks.push(...findLeaks(child, initialPotSize, initialOopCombos, initialIpCombos, newOopPath, newIpPath, childReach, newPot, newFacingBet, oopCombos, ipCombos, false, hideRootFromLine));
  }

  return leaks;
}

const DEFAULT_HEIGHT = 280;
const MIN_HEIGHT = 100;
const MAX_HEIGHT = 600;

export function LeaksTable({ tree, initialPotSize, initialOopCombos, initialIpCombos, visible, onToggleVisible, onLeakClick, hideRootFromLine = false }: LeaksTableProps) {
  const [activeTab, setActiveTab] = useState<string | null>('oop');
  const [sortField, setSortField] = useState<SortField>('relDiff');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [streetFilter, setStreetFilter] = useState<string | null>(null);
  const [panelHeight, setPanelHeight] = useState(DEFAULT_HEIGHT);
  const [copied, setCopied] = useState(false);
  const dragStartY = useRef<number>(0);
  const dragStartHeight = useRef<number>(DEFAULT_HEIGHT);

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
      l.type === 'overfold' ? 'Overfold' : l.type === 'underfold' ? 'Underfold' : l.type === 'overbluff' ? 'Overbluff' : 'Underbluff',
      streetLabels[l.street],
      l.path,
      l.potSize.toFixed(1),
      (l.reach * 100).toFixed(1),
      l.combos.toFixed(1),
      Math.round(l.frequency * 100).toString(),
      Math.round(l.gtoFrequency * 100).toString(),
      `${l.type === 'overfold' || l.type === 'overbluff' ? '+' : '-'}${Math.round(l.diff * 100)}`,
      Math.round(l.relDiff * 100).toString(),
    ]);
    const tsv = [headers, ...rows].map(r => r.join('\t')).join('\n');
    navigator.clipboard.writeText(tsv).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  const allLeaks = useMemo(() => findLeaks(tree, initialPotSize, initialOopCombos, initialIpCombos, [], [], 1, initialPotSize, 0, initialOopCombos, initialIpCombos, true, hideRootFromLine), [tree, initialPotSize, initialOopCombos, initialIpCombos, hideRootFromLine]);

  // Filter and sort leaks
  const filterAndSortLeaks = (leaks: Leak[]) => {
    let filtered = leaks;

    if (typeFilter) {
      filtered = filtered.filter(l => l.type === typeFilter);
    }

    if (streetFilter) {
      filtered = filtered.filter(l => l.street === streetFilter);
    }

    return filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'type':
          comparison = a.type.localeCompare(b.type);
          break;
        case 'street':
          const streetOrder = { flop: 0, turn: 1, river: 2 };
          comparison = streetOrder[a.street] - streetOrder[b.street];
          break;
        case 'potSize':
          comparison = a.potSize - b.potSize;
          break;
        case 'reach':
          comparison = a.reach - b.reach;
          break;
        case 'diff':
          comparison = a.diff - b.diff;
          break;
        case 'combos':
          comparison = a.combos - b.combos;
          break;
        case 'relDiff':
          comparison = a.relDiff - b.relDiff;
          break;
      }
      return sortDirection === 'desc' ? -comparison : comparison;
    });
  };

  const oopLeaks = filterAndSortLeaks(allLeaks.filter(l => l.player === 'OOP'));
  const ipLeaks = filterAndSortLeaks(allLeaks.filter(l => l.player === 'IP'));

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <Table.Th
      onClick={() => handleSort(field)}
      style={{ cursor: 'pointer', userSelect: 'none' }}
    >
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

  const renderTable = (leaks: Leak[]) => {
    if (leaks.length === 0) {
      return <div className="leaks-table-empty">No leaks detected</div>;
    }

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
            <Table.Tr
              key={i}
              onClick={() => onLeakClick?.(leak.nodeId)}
              style={onLeakClick ? { cursor: 'pointer' } : undefined}
            >
              <Table.Td className={`leak-type-${leak.type}`}>
                {leak.type === 'overfold' ? 'Overfold' : leak.type === 'underfold' ? 'Underfold' : leak.type === 'overbluff' ? 'Overbluff' : 'Underbluff'}
              </Table.Td>
              <Table.Td>
                <span className={`street-pill ${leak.street}`}>
                  {streetLabels[leak.street]}
                </span>
              </Table.Td>
              <Table.Td className="leak-line">
                {leak.path.split(' → ').map((part, j, arr) => (
                  <span key={j}>
                    {part}
                    {j < arr.length - 1 && <span className="leak-arrow"> → </span>}
                  </span>
                ))}
              </Table.Td>
              <Table.Td>{leak.potSize.toFixed(1)} BB</Table.Td>
              <Table.Td>{(leak.reach * 100).toFixed(1)}%</Table.Td>
              <Table.Td>{leak.combos.toFixed(1)}</Table.Td>
              <Table.Td>{Math.round(leak.frequency * 100)}%</Table.Td>
              <Table.Td>{Math.round(leak.gtoFrequency * 100)}%</Table.Td>
              <Table.Td className={`leak-type-${leak.type}`}>
                {leak.type === 'overfold' || leak.type === 'overbluff' ? '+' : '-'}{Math.round(leak.diff * 100)}%
              </Table.Td>
              <Table.Td>{Math.round(leak.relDiff * 100)}%</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    );
  };

  const totalLeaks = allLeaks.length;

  return (
    <div className="leaks-panel" style={visible ? { height: panelHeight } : undefined}>
      <div className="leaks-resize-handle" onPointerDown={handleResizeStart} />
      <div className="leaks-table-header-bar">
        <Group gap="sm" align="center">
          <ActionIcon
            variant="subtle"
            onClick={onToggleVisible}
            title={visible ? 'Hide leaks panel' : 'Show leaks panel'}
          >
            {visible ? <IconChevronDown size={18} /> : <IconChevronUp size={18} />}
          </ActionIcon>
          <Text fw={600} size="sm">
            Leaks ({totalLeaks})
          </Text>
        </Group>
        {visible && (
          <Group gap="sm">
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
              onClick={() => handleCopy(activeTab === 'ip' ? ipLeaks : oopLeaks)}
              title="Copy as table (paste into Google Sheets)"
              color={copied ? 'teal' : undefined}
            >
              {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
            </ActionIcon>
          </Group>
        )}
      </div>

      <div className="leaks-table-container">
        <Collapse in={visible}>
          <Tabs value={activeTab} onChange={setActiveTab}>
            <Tabs.List>
              <Tabs.Tab value="oop">
                OOP Leaks ({oopLeaks.length})
              </Tabs.Tab>
              <Tabs.Tab value="ip">
                IP Leaks ({ipLeaks.length})
              </Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="oop" pt="sm">
              {renderTable(oopLeaks)}
            </Tabs.Panel>

            <Tabs.Panel value="ip" pt="sm">
              {renderTable(ipLeaks)}
            </Tabs.Panel>
          </Tabs>
        </Collapse>
      </div>
    </div>
  );
}
