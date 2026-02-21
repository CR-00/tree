'use client';

import { useState, useEffect } from 'react';
import {
  Modal,
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
} from '@mantine/core';
import { Profile, BaseTreeNode, Player, actionLabels } from '@/types';

interface ProfileEditorProps {
  opened: boolean;
  onClose: () => void;
  profile: Profile | null;
  gtoProfile: Profile;
  tree: BaseTreeNode;
  onSave: (profile: Omit<Profile, 'spotId'>) => void;
  player: Player;
  onExport?: () => void;
  onImport?: () => void;
}

// Flatten tree to get all nodes for a specific player
function getPlayerNodes(node: BaseTreeNode, player: Player, path: string[] = []): Array<{ node: BaseTreeNode; path: string[] }> {
  const results: Array<{ node: BaseTreeNode; path: string[] }> = [];
  const currentPath = [...path, actionLabels[node.action]];

  if (node.player === player) {
    results.push({ node, path: currentPath });
  }

  for (const child of node.children) {
    results.push(...getPlayerNodes(child, player, currentPath));
  }

  return results;
}

export function ProfileEditor({
  opened,
  onClose,
  profile,
  gtoProfile,
  tree,
  onSave,
  player,
  onExport,
  onImport,
}: ProfileEditorProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [nodeData, setNodeData] = useState<Record<string, { frequency: number; weakPercent?: number }>>({});

  // Get all nodes for this player, sorted by path length (earliest nodes first)
  const playerNodes = getPlayerNodes(tree, player).sort((a, b) => a.path.length - b.path.length);

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
    <Modal
      opened={opened}
      onClose={onClose}
      title={profile ? `Edit Profile: ${profile.name}` : `New ${player} Profile`}
      size="lg"
    >
      <Stack gap="md">
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

        <ScrollArea h={300}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Line</Table.Th>
                <Table.Th>Action</Table.Th>
                <Table.Th>GTO %</Table.Th>
                <Table.Th>{profile?.isGto ? 'Value %' : 'Freq %'}</Table.Th>
                <Table.Th>Weak %</Table.Th>
                <Table.Th></Table.Th>
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
                      <Text size="xs" c="dimmed">{path.join(' → ')}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge size="sm" variant="light">
                        {actionLabels[node.action]}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      {!profile?.isGto && (
                        <Text size="sm">{Math.round(gtoFrequency * 100)}%</Text>
                      )}
                    </Table.Td>
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
    </Modal>
  );
}
