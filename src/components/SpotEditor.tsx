'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Modal,
  TextInput,
  Textarea,
  NumberInput,
  Button,
  Group,
  Stack,
  Table,
  Select,
  Text,
  ScrollArea,
  Box,
} from '@mantine/core';
import { Spot, BaseTreeNode, Action, Player, Street, actionLabels } from '@/types';

interface SpotEditorProps {
  opened: boolean;
  onClose: () => void;
  spot: Spot | null;
  onSave: (spot: Spot) => void;
}

// Flatten tree to list of nodes with their paths
interface FlatNode {
  node: BaseTreeNode;
  path: string;
  depth: number;
  parentId: string | null;
}

function flattenTree(node: BaseTreeNode, path: string = '', depth: number = 0, parentId: string | null = null): FlatNode[] {
  const result: FlatNode[] = [{ node, path: path || 'root', depth, parentId }];
  for (const child of node.children) {
    result.push(...flattenTree(child, `${path}${path ? ' → ' : ''}${actionLabels[child.action]}`, depth + 1, node.id));
  }
  return result;
}

// Deep clone tree
function cloneTree(node: BaseTreeNode): BaseTreeNode {
  return {
    ...node,
    children: node.children.map(cloneTree),
  };
}

// Find and update node in tree
function updateNodeInTree(tree: BaseTreeNode, nodeId: string, updates: Partial<BaseTreeNode>): BaseTreeNode {
  if (tree.id === nodeId) {
    return { ...tree, ...updates, children: tree.children.map(c => cloneTree(c)) };
  }
  return {
    ...tree,
    children: tree.children.map(child => updateNodeInTree(child, nodeId, updates)),
  };
}

// Add child to node
function addChildToNode(tree: BaseTreeNode, parentId: string, newChild: BaseTreeNode): BaseTreeNode {
  if (tree.id === parentId) {
    return {
      ...tree,
      children: [...tree.children, newChild],
    };
  }
  return {
    ...tree,
    children: tree.children.map(child => addChildToNode(child, parentId, newChild)),
  };
}

// Remove node from tree
function removeNodeFromTree(tree: BaseTreeNode, nodeId: string): BaseTreeNode {
  return {
    ...tree,
    children: tree.children
      .filter(child => child.id !== nodeId)
      .map(child => removeNodeFromTree(child, nodeId)),
  };
}

// Generate unique ID
function generateId(parentId: string, action: Action): string {
  const actionCode = action === 'bet' ? 'b' : action === 'check' ? 'x' : action === 'raise' ? 'r' : action === 'fold' ? 'f' : 'c';
  return `${parentId}-${actionCode}-${Date.now().toString(36)}`;
}

// Get next player
function getNextPlayer(currentPlayer: Player): Player {
  return currentPlayer === 'OOP' ? 'IP' : 'OOP';
}

// Create default empty tree
function createDefaultTree(): BaseTreeNode {
  return {
    id: 'root',
    action: 'check',
    player: 'OOP',
    street: 'flop',
    children: [],
  };
}

export function SpotEditor({ opened, onClose, spot, onSave }: SpotEditorProps) {
  const [name, setName] = useState(spot?.name || '');
  const [description, setDescription] = useState(spot?.description || '');
  const [potSize, setPotSize] = useState(spot?.potSize ?? 6.5);
  const [oopCombos, setOopCombos] = useState(spot?.oopCombos ?? 100);
  const [ipCombos, setIpCombos] = useState(spot?.ipCombos ?? 100);
  const [tree, setTree] = useState<BaseTreeNode>(spot?.tree ? cloneTree(spot.tree) : createDefaultTree());

  // Reset form when modal opens with new spot
  useEffect(() => {
    if (opened) {
      if (spot) {
        setName(spot.name);
        setDescription(spot.description);
        setPotSize(spot.potSize ?? 6.5);
        setOopCombos(spot.oopCombos ?? 100);
        setIpCombos(spot.ipCombos ?? 100);
        setTree(cloneTree(spot.tree));
      } else {
        setName('');
        setDescription('');
        setPotSize(6.5);
        setOopCombos(100);
        setIpCombos(100);
        setTree(createDefaultTree());
      }
    }
  }, [opened, spot]);

  const flatNodes = flattenTree(tree);

  const handleUpdateNode = useCallback((nodeId: string, field: keyof BaseTreeNode, value: unknown) => {
    setTree(prev => updateNodeInTree(prev, nodeId, { [field]: value }));
  }, []);

  const handleAddChild = useCallback((parentId: string, parentPlayer: Player, parentStreet: Street) => {
    const newChild: BaseTreeNode = {
      id: generateId(parentId, 'bet'),
      action: 'bet',
      player: getNextPlayer(parentPlayer),
      street: parentStreet,
      children: [],
    };
    setTree(prev => addChildToNode(prev, parentId, newChild));
  }, []);

  const handleRemoveNode = useCallback((nodeId: string) => {
    if (nodeId === 'root') return;
    setTree(prev => removeNodeFromTree(prev, nodeId));
  }, []);

  const handleSave = () => {
    if (!name.trim()) return;

    onSave({
      id: spot?.id || '',
      name: name.trim(),
      description: description.trim(),
      potSize,
      oopCombos,
      ipCombos,
      tree,
    });
    onClose();
  };

  const handleClose = () => {
    // Reset to original values
    if (spot) {
      setName(spot.name);
      setDescription(spot.description);
      setPotSize(spot.potSize ?? 6.5);
      setOopCombos(spot.oopCombos ?? 100);
      setIpCombos(spot.ipCombos ?? 100);
      setTree(cloneTree(spot.tree));
    } else {
      setName('');
      setDescription('');
      setPotSize(6.5);
      setOopCombos(100);
      setIpCombos(100);
      setTree(createDefaultTree());
    }
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={spot ? `Edit Spot: ${spot.name}` : 'Create New Spot'}
      size="xl"
    >
      <Stack gap="md">
        <TextInput
          label="Name"
          placeholder="e.g., SRP, 3-Bet Pot"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          required
        />

        <Textarea
          label="Description"
          placeholder="Describe this spot..."
          value={description}
          onChange={(e) => setDescription(e.currentTarget.value)}
          rows={2}
        />

        <NumberInput
          label="Pot Size (BB)"
          placeholder="e.g., 6.5"
          value={potSize}
          onChange={(val) => setPotSize(typeof val === 'number' ? val : 6.5)}
          min={0}
          step={0.5}
          decimalScale={1}
        />

        <Group grow>
          <NumberInput
            label="OOP Combos"
            placeholder="e.g., 282"
            value={oopCombos}
            onChange={(val) => setOopCombos(typeof val === 'number' ? val : 100)}
            min={1}
            max={1326}
            step={1}
          />
          <NumberInput
            label="IP Combos"
            placeholder="e.g., 332"
            value={ipCombos}
            onChange={(val) => setIpCombos(typeof val === 'number' ? val : 100)}
            min={1}
            max={1326}
            step={1}
          />
        </Group>

        <Box>
          <Text fw={500} size="sm" mb="xs">Tree Structure</Text>
          <Text size="xs" c="dimmed" mb="sm">
            Define the tree structure. GTO frequencies are set in the GTO profile.
          </Text>
          <ScrollArea h={400}>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Path</Table.Th>
                  <Table.Th w={90}>Action</Table.Th>
                  <Table.Th w={70}>Size %</Table.Th>
                  <Table.Th w={80}>Player</Table.Th>
                  <Table.Th w={90}>Street</Table.Th>
                  <Table.Th w={100}>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {flatNodes.map(({ node, path, depth }) => (
                  <Table.Tr key={node.id}>
                    <Table.Td>
                      <Text size="sm" style={{ paddingLeft: depth * 12 }}>
                        {path || 'Root'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Select
                        size="xs"
                        value={node.action}
                        onChange={(v) => handleUpdateNode(node.id, 'action', v)}
                        data={[
                          { value: 'check', label: 'Check' },
                          { value: 'bet', label: 'Bet' },
                          { value: 'call', label: 'Call' },
                          { value: 'raise', label: 'Raise' },
                          { value: 'fold', label: 'Fold' },
                        ]}
                        disabled={node.id === 'root'}
                      />
                    </Table.Td>
                    <Table.Td>
                      {node.action === 'raise' && (
                        <NumberInput
                          size="xs"
                          value={node.sizing ?? 3}
                          onChange={(v) => handleUpdateNode(node.id, 'sizing', typeof v === 'number' ? v : 3)}
                          min={2}
                          max={100}
                          step={0.5}
                          decimalScale={1}
                          w={60}
                          suffix="x"
                        />
                      )}
                      {node.action === 'bet' && (
                        <NumberInput
                          size="xs"
                          value={node.sizing ?? 50}
                          onChange={(v) => handleUpdateNode(node.id, 'sizing', typeof v === 'number' ? v : 50)}
                          min={1}
                          max={500}
                          step={25}
                          w={60}
                        />
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Select
                        size="xs"
                        value={node.player}
                        onChange={(v) => handleUpdateNode(node.id, 'player', v)}
                        data={[
                          { value: 'OOP', label: 'OOP' },
                          { value: 'IP', label: 'IP' },
                        ]}
                      />
                    </Table.Td>
                    <Table.Td>
                      <Select
                        size="xs"
                        value={node.street}
                        onChange={(v) => handleUpdateNode(node.id, 'street', v)}
                        data={[
                          { value: 'flop', label: 'Flop' },
                          { value: 'turn', label: 'Turn' },
                          { value: 'river', label: 'River' },
                        ]}
                      />
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        <Button
                          size="compact-xs"
                          variant="light"
                          onClick={() => handleAddChild(node.id, node.player, node.street)}
                        >
                          +
                        </Button>
                        {node.id !== 'root' && (
                          <Button
                            size="compact-xs"
                            variant="light"
                            color="red"
                            onClick={() => handleRemoveNode(node.id)}
                          >
                            x
                          </Button>
                        )}
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Box>

        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            {spot ? 'Save Changes' : 'Create Spot'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
