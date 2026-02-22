'use client';

import { useState, useEffect } from 'react';
import {
  Modal, // used as Modal.Root / Modal.Header etc.
  TextInput,
  Textarea,
  Stack,
  Button,
  Group,
  Text,
  NumberInput,
  Table,
  ScrollArea,
  Badge,
  ActionIcon,
} from '@mantine/core';
import { IconMaximize, IconMinimize, IconEye } from '@tabler/icons-react';
import { Profile, BaseTreeNode, Player, actionLabels } from '@/types';

interface ProfileEditorProps {
  opened: boolean;
  onClose: () => void;
  profile: Profile | null;
  gtoProfile: Profile;
  tree: BaseTreeNode;
  initialPotSize: number;
  hideRootFromLine?: boolean;
  onSave: (profile: Omit<Profile, 'spotId'>) => void;
  onNodeClick?: (nodeId: string) => void;
  player: Player;
  onExport?: () => void;
  onImport?: () => void;
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

function calcNextPot(action: string, pot: number, facingBet: number, sizing?: number): { pot: number; facingBet: number } {
  switch (action) {
    case 'bet': {
      const betAmount = pot * (sizing || 50) / 100;
      return { pot: pot + betAmount, facingBet: betAmount };
    }
    case 'raise': {
      const raiseTotal = (sizing || 3) * facingBet;
      return { pot: pot + raiseTotal, facingBet: raiseTotal - facingBet };
    }
    case 'call':
      return { pot: pot + facingBet, facingBet: 0 };
    default:
      return { pot, facingBet: 0 };
  }
}

// Flatten tree to get all nodes for a specific player, using street-aware path segments
function getPlayerNodes(
  node: BaseTreeNode,
  player: Player,
  oopPath: PathSegment[] = [],
  ipPath: PathSegment[] = [],
  depth = 0,
  pot = 0,
  facingBet = 0,
  isRoot = true,
  hideRootFromLine = false,
): Array<{ node: BaseTreeNode; path: string; depth: number }> {
  const results: Array<{ node: BaseTreeNode; path: string; depth: number }> = [];

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

  const { pot: newPot, facingBet: newFacingBet } = calcNextPot(node.action, pot, facingBet, node.sizing);

  if (node.player === player) {
    const playerPath = player === 'OOP' ? newOopPath : newIpPath;
    results.push({ node, path: formatPath(playerPath), depth });
  }

  for (const child of node.children) {
    results.push(...getPlayerNodes(child, player, newOopPath, newIpPath, depth + 1, newPot, newFacingBet, false, hideRootFromLine));
  }

  return results;
}

export function ProfileEditor({
  opened,
  onClose,
  profile,
  gtoProfile,
  tree,
  initialPotSize,
  hideRootFromLine = false,
  onSave,
  onNodeClick,
  player,
  onExport,
  onImport,
}: ProfileEditorProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [nodeData, setNodeData] = useState<Record<string, { frequency: number; weakPercent?: number }>>({});

  // Get all nodes for this player, sorted by path length (earliest nodes first)
  const playerNodes = getPlayerNodes(tree, player, [], [], 0, initialPotSize, 0, true, hideRootFromLine).sort((a, b) => a.depth - b.depth);

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setDescription(profile.description);
      setNodeData({ ...profile.nodeData });
    } else {
      setName('');
      setDescription('');
      setNodeData({});
    }
  }, [profile, opened]);

  const handleFrequencyChange = (nodeId: string, value: number | string) => {
    const freq = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(freq)) return;

    setNodeData(prev => ({
      ...prev,
      [nodeId]: {
        ...prev[nodeId],
        frequency: freq / 100,
      },
    }));
  };

  const handleWeakPercentChange = (nodeId: string, value: number | string) => {
    const weak = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(weak)) return;

    setNodeData(prev => ({
      ...prev,
      [nodeId]: {
        ...prev[nodeId],
        weakPercent: weak / 100,
      },
    }));
  };

  const handleClearNode = (nodeId: string) => {
    setNodeData(prev => {
      const next = { ...prev };
      delete next[nodeId];
      return next;
    });
  };

  const handleSave = () => {
    const newProfile: Omit<Profile, 'spotId'> = {
      id: profile?.id || `${player.toLowerCase()}-${Date.now()}`,
      name,
      description,
      player,
      isGto: profile?.isGto || false,
      nodeData,
    };
    onSave(newProfile);
    onClose();
  };

  const hasWeak = (node: BaseTreeNode) => node.action === 'bet' || node.action === 'raise';

  return (
    <Modal.Root opened={opened} onClose={onClose} size={isFullscreen ? undefined : 'lg'} fullScreen={isFullscreen}>
      <Modal.Overlay />
      <Modal.Content>
        <Modal.Header>
          <Modal.Title>{profile ? `Edit Profile: ${profile.name}` : `New ${player} Profile`}</Modal.Title>
          <Group gap={4}>
            <ActionIcon variant="subtle" size="md" onClick={() => setIsFullscreen(f => !f)} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
              {isFullscreen ? <IconMinimize size={18} /> : <IconMaximize size={18} />}
            </ActionIcon>
            <Modal.CloseButton />
          </Group>
        </Modal.Header>
        <Modal.Body>
      <Stack gap="md" style={isFullscreen ? { height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' } : undefined}>
        <TextInput
          label="Profile Name"
          placeholder="e.g., Fish, Regular, Nit"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          disabled={profile?.isGto}
        />
        <Textarea
          label="Description"
          placeholder="Describe this player type..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <Text size="sm" fw={500}>
          Node Frequencies
        </Text>
        <Text size="xs" c="dimmed">
          {profile?.isGto
            ? 'Edit the GTO baseline frequencies for this spot.'
            : 'Leave blank to use GTO frequency. Values are percentages (0-100).'}
        </Text>

        <ScrollArea h={isFullscreen ? undefined : 300} style={isFullscreen ? { flex: 1, minHeight: 0 } : undefined}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Line</Table.Th>
                <Table.Th>Action</Table.Th>
                {!profile?.isGto && <Table.Th>GTO %</Table.Th>}
                <Table.Th>{profile?.isGto ? 'Value %' : 'Freq %'}</Table.Th>
                <Table.Th>Weak %</Table.Th>
                <Table.Th></Table.Th>
                {onNodeClick && <Table.Th></Table.Th>}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {playerNodes.map(({ node, path }) => {
                // Get GTO values from the GTO profile
                const gtoData = gtoProfile.nodeData[node.id];
                const gtoFrequency = gtoData?.frequency ?? 0;
                const gtoWeakPercent = gtoData?.weakPercent;

                // Get current profile values
                const data = nodeData[node.id];
                const freqValue = data?.frequency !== undefined ? Math.round(data.frequency * 100) : '';
                const weakValue = data?.weakPercent !== undefined ? Math.round(data.weakPercent * 100) : '';

                return (
                  <Table.Tr key={node.id}>
                    <Table.Td>
                      <Text size="xs" c="dimmed">{path || 'root'}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge size="sm" variant="light">
                        {actionLabels[node.action]}
                      </Badge>
                    </Table.Td>
                    {!profile?.isGto && (
                      <Table.Td>
                        <Text size="sm">{Math.round(gtoFrequency * 100)}%</Text>
                      </Table.Td>
                    )}
                    <Table.Td>
                      <NumberInput
                        size="xs"
                        placeholder={profile?.isGto ? '0' : 'GTO'}
                        value={freqValue}
                        onChange={(v) => handleFrequencyChange(node.id, v)}
                        min={0}
                        max={100}
                        w={70}
                        hideControls
                      />
                    </Table.Td>
                    <Table.Td>
                      {hasWeak(node) ? (
                        <NumberInput
                          size="xs"
                          placeholder={profile?.isGto ? '0' : 'GTO'}
                          value={weakValue}
                          onChange={(v) => handleWeakPercentChange(node.id, v)}
                          min={0}
                          max={100}
                          w={70}
                          hideControls
                        />
                      ) : (
                        <Text size="xs" c="dimmed">—</Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      {data && !profile?.isGto && (
                        <Button
                          size="xs"
                          variant="subtle"
                          color="gray"
                          onClick={() => handleClearNode(node.id)}
                        >
                          Clear
                        </Button>
                      )}
                    </Table.Td>
                    {onNodeClick && (
                      <Table.Td>
                        <ActionIcon
                          variant="subtle"
                          size="xs"
                          color="gray"
                          title="Jump to node"
                          onClick={() => { onNodeClick(node.id); onClose(); }}
                        >
                          <IconEye size={14} />
                        </ActionIcon>
                      </Table.Td>
                    )}
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </ScrollArea>

        <Group justify="space-between" mt="md">
          <Group gap="xs">
            {onExport && profile && (
              <Button variant="subtle" color="gray" onClick={onExport}>
                Export
              </Button>
            )}
            {onImport && (
              <Button variant="subtle" color="gray" onClick={onImport}>
                Import
              </Button>
            )}
          </Group>
          <Group gap="xs">
            <Button variant="subtle" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!name.trim()}>
              Save Profile
            </Button>
          </Group>
        </Group>
      </Stack>
        </Modal.Body>
      </Modal.Content>
    </Modal.Root>
  );
}
