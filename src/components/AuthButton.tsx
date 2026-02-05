'use client';

import { Button, Menu, Avatar, Group, Text } from '@mantine/core';
import { signIn, signOut, useSession } from 'next-auth/react';

const SKIP_AUTH = process.env.NEXT_PUBLIC_SKIP_AUTH === 'true';

export function AuthButton() {
  const { data: session, status } = useSession();

  // Dev mode - hide auth button
  if (SKIP_AUTH) {
    return null;
  }

  if (status === 'loading') {
    return <Button variant="subtle" loading>Loading...</Button>;
  }

  if (!session) {
    return (
      <Button onClick={() => signIn('google')} variant="light">
        Sign in with Google
      </Button>
    );
  }

  return (
    <Menu shadow="md" width={200}>
      <Menu.Target>
        <Button variant="subtle" px="xs">
          <Group gap="xs">
            <Avatar src={session.user.image} size="sm" radius="xl" />
            <Text size="sm" truncate style={{ maxWidth: 120 }}>
              {session.user.name || session.user.email}
            </Text>
          </Group>
        </Button>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Label>{session.user.email}</Menu.Label>
        <Menu.Divider />
        <Menu.Item color="red" onClick={() => signOut()}>
          Sign out
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
