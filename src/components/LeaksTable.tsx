'use client';

import { useState, useMemo } from 'react';
import { Table, Tabs, Select, Group, ActionIcon, Text, Collapse } from '@mantine/core';
import { IconChevronDown, IconChevronUp, IconArrowsSort } from '@tabler/icons-react';
import { TreeNode, actionLabels, streetLabels, Street } from '@/types';

interface Leak {
  nodeId: string;
  path: string;
  player: 'OOP' | 'IP';
  type: 'overfold' | 'underfold' | 'overbluff';
  frequency: number;
  gtoFrequency: number;
  diff: number;
  reach: number;
  street: Street;
  potSize: number;
  combos: number;
}

interface LeaksTableProps {
  tree: TreeNode;
  initialPotSize: number;
  initialOopCombos: number;
  initialIpCombos: number;
  visible: boolean;
  onToggleVisible: () => void;
  onLeakClick?: (nodeId: string) => void;
}

type SortField = 'type' | 'street' | 'potSize' | 'reach' | 'diff' | 'combos';
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

function findLeaks(
  node: TreeNode,
  initialPotSize: number,
  initialOopCombos: number,
  initialIpCombos: number,
  oopPath: string[] = [],
  ipPath: string[] = [],
  parentReach: number = 1,
  pot: number = initialPotSize,
  facingBet: number = 0,
  parentOopCombos: number = initialOopCombos,
  parentIpCombos: number = initialIpCombos
): Leak[] {
  const leaks: Leak[] = [];

  // Calculate reach probability
  const reach = parentReach * node.frequency;

  // Calculate combos
  const oopCombos = node.player === 'OOP' ? parentOopCombos * node.frequency : parentOopCombos;
  const ipCombos = node.player === 'IP' ? parentIpCombos * node.frequency : parentIpCombos;
  const actingCombos = node.player === 'OOP' ? oopCombos : ipCombos;

  // Calculate pot after this action
  const { newPot, newFacingBet } = calculatePot(node.action, pot, facingBet, node.sizing);

  // Update the appropriate player's path
  const newOopPath = node.player === 'OOP'
    ? [...oopPath, actionLabels[node.action]]
    : oopPath;
  const newIpPath = node.player === 'IP'
    ? [...ipPath, actionLabels[node.action]]
    : ipPath;

  // Check for fold leaks
  if (node.action === 'fold') {
    const playerPath = node.player === 'OOP' ? newOopPath : newIpPath;
    if (node.frequency > node.gtoFrequency) {
      leaks.push({
        nodeId: node.id,
        path: playerPath.join(' → '),
        player: node.player,
        type: 'overfold',
        frequency: node.frequency,
        gtoFrequency: node.gtoFrequency,
        diff: node.frequency - node.gtoFrequency,
        reach,
        street: node.street,
        potSize: newPot,
        combos: actingCombos,
      });
    } else if (node.frequency < node.gtoFrequency) {
      leaks.push({
        nodeId: node.id,
        path: playerPath.join(' → '),
        player: node.player,
        type: 'underfold',
        frequency: node.frequency,
        gtoFrequency: node.gtoFrequency,
        diff: node.gtoFrequency - node.frequency,
        reach,
        street: node.street,
        potSize: newPot,
        combos: actingCombos,
      });
    }
  }

  // Check for overbluffs (B/R nodes with weak% > gtoWeak%)
  if ((node.action === 'bet' || node.action === 'raise') &&
      node.weakPercent !== undefined &&
      node.gtoWeakPercent !== undefined &&
      node.weakPercent > node.gtoWeakPercent) {
    const playerPath = node.player === 'OOP' ? newOopPath : newIpPath;
    leaks.push({
      nodeId: node.id,
      path: playerPath.join(' → '),
      player: node.player,
      type: 'overbluff',
      frequency: node.weakPercent,
      gtoFrequency: node.gtoWeakPercent,
      diff: node.weakPercent - node.gtoWeakPercent,
      reach,
      street: node.street,
      potSize: newPot,
      combos: actingCombos,
    });
  }

  // Recurse into children
  for (const child of node.children) {
    leaks.push(...findLeaks(child, initialPotSize, initialOopCombos, initialIpCombos, newOopPath, newIpPath, reach, newPot, newFacingBet, oopCombos, ipCombos));
  }

  return leaks;
}

export function LeaksTable({ tree, initialPotSize, initialOopCombos, initialIpCombos, visible, onToggleVisible, onLeakClick }: LeaksTableProps) {
  const [activeTab, setActiveTab] = useState<string | null>('oop');
  const [sortField, setSortField] = useState<SortField>('reach');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [streetFilter, setStreetFilter] = useState<string | null>(null);

  const allLeaks = useMemo(() => findLeaks(tree, initialPotSize, initialOopCombos, initialIpCombos), [tree, initialPotSize, initialOopCombos, initialIpCombos]);

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
                {leak.type === 'overfold' ? 'Overfold' : leak.type === 'underfold' ? 'Underfold' : 'Overbluff'}
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
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    );
  };

  const totalLeaks = allLeaks.length;

  return (
    <div className="leaks-table-container">
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
          </Group>
        )}
      </div>

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
  );
}
