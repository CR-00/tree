'use client';

import { NavLink, Stack, Title, Text, Box, ActionIcon, Button, Menu, CloseButton } from '@mantine/core';
import { IconSitemap } from '@tabler/icons-react';
import { Spot } from '@/types';

interface SidebarProps {
  spots: Spot[];
  selectedSpotId: string;
  onSelectSpot: (spotId: string) => void;
  onEditSpot: (spot: Spot) => void;
  onDeleteSpot: (spotId: string) => void;
  onCreateSpot: () => void;
  onExportSpot?: (spot: Spot) => void;
  onImportSpot?: () => void;
  onClose?: () => void;
}

export function Sidebar({
  spots,
  selectedSpotId,
  onSelectSpot,
  onEditSpot,
  onDeleteSpot,
  onCreateSpot,
  onExportSpot,
  onImportSpot,
  onClose,
}: SidebarProps) {
  return (
    <Stack gap="md" p="md" style={{ position: 'relative' }}>
      {onClose && (
        <CloseButton
          onClick={onClose}
          size="lg"
          className="mobile-close-btn"
          style={{ position: 'absolute', top: 12, right: 12 }}
        />
      )}
      <Box ta="center" mt="sm" mb={4}>
        <IconSitemap size={40} color="white" />
        <Title order={4} c="white" mt={4}>Tree</Title>
      </Box>
      {spots.length === 0 ? (
        <Box className="empty-state">
          <Text size="sm" c="dimmed" ta="center" mb="md">
            No spots yet. Create your first spot to start analyzing game trees.
          </Text>
          <Button fullWidth color="teal" onClick={onCreateSpot}>
            + Create Your First Spot
          </Button>
        </Box>
      ) : (
        <Stack gap="xs">
          {spots.map((spot) => (
            <NavLink
              key={spot.id}
              label={spot.name}
              description={spot.description}
              active={spot.id === selectedSpotId}
              onClick={() => onSelectSpot(spot.id)}
              variant="subtle"
              className={`spot-nav-link ${spot.id === selectedSpotId ? 'active' : ''}`}
              styles={{
                label: { fontWeight: spot.id === selectedSpotId ? 700 : 400 },
              }}
              style={{ borderRadius: 8 }}
              rightSection={
                <Menu position="bottom-end" withArrow>
                  <Menu.Target>
                    <ActionIcon
                      variant="subtle"
                      size="sm"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Text size="xs">⋮</Text>
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Item onClick={() => onEditSpot(spot)}>
                      Edit
                    </Menu.Item>
                    {onExportSpot && (
                      <Menu.Item onClick={() => onExportSpot(spot)}>
                        Export
                      </Menu.Item>
                    )}
                    <Menu.Item
                      color="red"
                      onClick={() => {
                        if (confirm(`Delete "${spot.name}"?`)) {
                          onDeleteSpot(spot.id);
                        }
                      }}
                    >
                      Delete
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              }
            />
          ))}
          <Button fullWidth color="teal" variant="light" onClick={onCreateSpot} mt="sm">
            + New Spot
          </Button>
          {onImportSpot && (
            <Button fullWidth color="teal" variant="subtle" onClick={onImportSpot}>
              Import Spot
            </Button>
          )}
        </Stack>
      )}
    </Stack>
  );
}
