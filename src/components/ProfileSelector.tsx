'use client';

import { Select, Stack, Text, Group, Paper, Badge, ActionIcon, Button } from '@mantine/core';
import { Profile, Player } from '@/types';

interface ProfileSelectorProps {
  profiles: Profile[];
  oopProfileId: string;
  ipProfileId: string;
  onOOPProfileChange: (profileId: string) => void;
  onIPProfileChange: (profileId: string) => void;
  onEditProfile: (profile: Profile) => void;
  onCreateProfile: (player: Player) => void;
}

export function ProfileSelector({
  profiles,
  oopProfileId,
  ipProfileId,
  onOOPProfileChange,
  onIPProfileChange,
  onEditProfile,
  onCreateProfile,
}: ProfileSelectorProps) {
  const oopProfiles = profiles.filter(p => p.player === 'OOP');
  const ipProfiles = profiles.filter(p => p.player === 'IP');

  const selectedOOP = oopProfiles.find(p => p.id === oopProfileId);
  const selectedIP = ipProfiles.find(p => p.id === ipProfileId);

  return (
    <Paper p="md" bg="dark.7" withBorder>
      <Text size="sm" fw={600} c="dimmed" mb="md">
        Player Profiles
      </Text>
      <Stack gap="md">
        <div>
          <Group gap="xs" mb={6} justify="space-between">
            <Group gap="xs">
              <Badge color="blue" size="sm">OOP</Badge>
              <Text size="xs" c="dimmed">{selectedOOP?.description}</Text>
            </Group>
          </Group>
          <Group gap="xs">
            <Select
              size="sm"
              value={oopProfileId}
              onChange={(value) => value && onOOPProfileChange(value)}
              data={oopProfiles.map(p => ({
                value: p.id,
                label: p.name,
              }))}
              style={{ flex: 1 }}
              styles={{
                input: {
                  backgroundColor: 'var(--mantine-color-dark-6)',
                  borderColor: 'var(--mantine-color-dark-4)',
                },
              }}
            />
            <ActionIcon
              variant="subtle"
              size="lg"
              onClick={() => selectedOOP && onEditProfile(selectedOOP)}
              title="Edit profile"
            >
              ✎
            </ActionIcon>
          </Group>
          <Button
            variant="subtle"
            size="xs"
            mt={6}
            onClick={() => onCreateProfile('OOP')}
            fullWidth
          >
            + New OOP Profile
          </Button>
        </div>

        <div>
          <Group gap="xs" mb={6} justify="space-between">
            <Group gap="xs">
              <Badge color="orange" size="sm">IP</Badge>
              <Text size="xs" c="dimmed">{selectedIP?.description}</Text>
            </Group>
          </Group>
          <Group gap="xs">
            <Select
              size="sm"
              value={ipProfileId}
              onChange={(value) => value && onIPProfileChange(value)}
              data={ipProfiles.map(p => ({
                value: p.id,
                label: p.name,
              }))}
              style={{ flex: 1 }}
              styles={{
                input: {
                  backgroundColor: 'var(--mantine-color-dark-6)',
                  borderColor: 'var(--mantine-color-dark-4)',
                },
              }}
            />
            <ActionIcon
              variant="subtle"
              size="lg"
              onClick={() => selectedIP && onEditProfile(selectedIP)}
              title="Edit profile"
            >
              ✎
            </ActionIcon>
          </Group>
          <Button
            variant="subtle"
            size="xs"
            mt={6}
            onClick={() => onCreateProfile('IP')}
            fullWidth
          >
            + New IP Profile
          </Button>
        </div>
      </Stack>
    </Paper>
  );
}
