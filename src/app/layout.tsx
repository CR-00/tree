import '@mantine/core/styles.css';
import './globals.css';
import { ColorSchemeScript, MantineProvider, createTheme } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { SessionProvider } from 'next-auth/react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Tree',
  description: 'Visualize poker decision trees',
};

const theme = createTheme({
  primaryColor: 'teal',
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ColorSchemeScript defaultColorScheme="dark" />
      </head>
      <body>
        <SessionProvider>
          <MantineProvider theme={theme} defaultColorScheme="dark">
            <ModalsProvider modalProps={{ zIndex: 1100 }}>
              {children}
            </ModalsProvider>
          </MantineProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
