'use client';

import { useState, useEffect } from 'react';
import { Drawer, NumberInput, Stack, Group, Badge, Button, Switch } from '@mantine/core';
import { SelectedNodeData } from './TreeView';
import { actionLabels } from '@/types';

interface NodeEditorProps {
  opened: boolean;
  onClose: () => void;
  node: SelectedNodeData | null;
  onSave: (nodeId: string, frequency: number, weakPercent?: number) => void;
  onSaveSizing?: (nodeId: string, sizing: number) => void;
}

export function NodeEditor({ opened, onClose, node, onSave, onSaveSizing }: NodeEditorProps) {
  const [frequency, setFrequency] = useState<number | string>(0);
  const [weakPercent, setWeakPercent] = useState<number | string>(0);
  const [sizing, setSizing] = useState<number | string>(50);
  const [weakEnabled, setWeakEnabled] = useState(false);
  const isRaise = node?.action === 'raise';

  // Sync state when node changes
  useEffect(() => {
    if (node) {
      setFrequency(Math.round(node.frequency * 100));
      const hasWeakData = node.weakPercent !== undefined || node.gtoWeakPercent !== undefined;
      setWeakEnabled(hasWeakData);
      setWeakPercent(node.weakPercent !== undefined ? Math.round(node.weakPercent * 100) : 0);
      setSizing(node.sizing !== undefined ? node.sizing : (node.action === 'raise' ? 3 : 50));
    }
  }, [node]);

  if (!node) return null;

  const isBetOrRaise = node.action === 'bet' || node.action === 'raise';
  const actionLabel = actionLabels[node.action as keyof typeof actionLabels] || node.action;

  const handleSave = () => {
    const freq = typeof frequency === 'number' ? frequency / 100 : 0;
    const weak = isBetOrRaise && weakEnabled && typeof weakPercent === 'number' ? weakPercent / 100 : undefined;
    onSave(node.nodeId, freq, weak);

    if (isBetOrRaise && onSaveSizing) {
      const defaultVal = isRaise ? 3 : 50;
      const sizingVal = typeof sizing === 'number' ? sizing : defaultVal;
      onSaveSizing(node.nodeId, sizingVal);
    }

    onClose();
  };

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title="Edit Node"
      position="right"
      size="sm"
    >
      <Stack gap="lg">
        <Group gap="xs">
          <Badge size="lg" variant="filled" color={node.player === 'OOP' ? 'blue' : 'orange'}>
            {node.player}
          </Badge>
          <Badge size="lg" variant="light">
            {actionLabel}
          </Badge>
        </Group>

        {isBetOrRaise && (
          isRaise ? (
            <NumberInput
              label="Raise size (x facing bet)"
              value={sizing}
              onChange={setSizing}
              min={2}
              max={100}
              step={0.5}
              decimalScale={1}
              suffix="x"
            />
          ) : (
            <NumberInput
              label="Bet size (% of pot)"
              value={sizing}
              onChange={setSizing}
              min={1}
              max={500}
              step={25}
              suffix="%"
            />
          )
        )}

        <NumberInput
          label="Frequency %"
          description={`GTO: ${Math.round(node.gtoFrequency * 100)}%`}
          value={frequency}
          onChange={setFrequency}
          min={0}
          max={100}
          suffix="%"
        />

        {isBetOrRaise && (
          <>
            <Switch
              label="Track weak %"
              checked={weakEnabled}
              onChange={(e) => setWeakEnabled(e.currentTarget.checked)}
            />
            {weakEnabled && (
              <NumberInput
                label="Weak %"
                description={node.gtoWeakPercent !== undefined ? `GTO: ${Math.round(node.gtoWeakPercent * 100)}%` : 'Optional'}
                value={weakPercent}
                onChange={setWeakPercent}
                min={0}
                max={100}
                suffix="%"
              />
            )}
          </>
        )}

        <Button onClick={handleSave} fullWidth>
          Save
        </Button>
      </Stack>
    </Drawer>
  );
}
