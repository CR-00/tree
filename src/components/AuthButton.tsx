'use client';

import { Avatar, Group, Text, UnstyledButton, Box } from '@mantine/core';
import { IconLogout } from '@tabler/icons-react';
import { signIn, signOut, useSession } from 'next-auth/react';

const SKIP_AUTH = process.env.NEXT_PUBLIC_SKIP_AUTH === 'true';

export function AuthButton() {
  const { data: session, status } = useSession();

  if (SKIP_AUTH) {
    return null;
  }

  if (status === 'loading') {
    return null;
  }

  if (!session) {
    return (
      <UnstyledButton
        onClick={() => signIn('discord')}
        className="user-button"
      >
        <Text size="sm" ta="center">Sign in with Discord</Text>
      </UnstyledButton>
    );
  }

  return (
    <Box style={{ borderTop: '1px solid var(--mantine-color-dark-4)' }}>
      <UnstyledButton
        onClick={() => signOut()}
        className="user-button"
      >
        <Group>
          <Avatar src={session.user.image} radius="xl" size="sm" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <Text size="sm" fw={500}>
              {session.user.name || 'User'}
            </Text>
          </div>
          <IconLogout size={14} stroke={1.5} />
        </Group>
      </UnstyledButton>
    </Box>
  );
}
