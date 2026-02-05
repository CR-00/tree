'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { AppShell, ScrollArea, LoadingOverlay, Center, Stack, Title, Text, Button, Paper, Divider } from '@mantine/core';
import { IconSitemap } from '@tabler/icons-react';
import { useSession, signIn } from 'next-auth/react';
import { Sidebar } from '@/components/Sidebar';
import { AuthButton } from '@/components/AuthButton';
import { TreeView, SelectedNodeData } from '@/components/TreeView';
import { LeaksTable } from '@/components/LeaksTable';
import { ProfileEditor } from '@/components/ProfileEditor';
import { SpotEditor } from '@/components/SpotEditor';
import { NodeEditor } from '@/components/NodeEditor';
import { applyProfilesToTree } from '@/utils/applyProfiles';
import { Profile, Player, Spot, BaseTreeNode, ProcessedSpot } from '@/types';

const SKIP_AUTH = process.env.NEXT_PUBLIC_SKIP_AUTH === 'true';

export default function Home() {
  const { data: session, status } = useSession();
  const [spots, setSpots] = useState<Spot[]>([]);
  const [selectedSpotId, setSelectedSpotId] = useState<string>('');
  const [oopProfileId, setOOPProfileId] = useState<string>('');
  const [ipProfileId, setIPProfileId] = useState<string>('');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  // Profile editor state
  const [profileEditorOpened, setProfileEditorOpened] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [editorPlayer, setEditorPlayer] = useState<Player>('OOP');

  // Spot editor state
  const [spotEditorOpened, setSpotEditorOpened] = useState(false);
  const [editingSpot, setEditingSpot] = useState<Spot | null>(null);

  // Node editor state
  const [nodeEditorOpened, setNodeEditorOpened] = useState(false);
  const [selectedNode, setSelectedNode] = useState<SelectedNodeData | null>(null);

  // Sidebar state - collapsed by default on mobile
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [mobileNavOpened, setMobileNavOpened] = useState(false);

  // Tree edit mode state
  const [treeEditMode, setTreeEditMode] = useState(false);

  // Leaks panel visibility
  const [leaksPanelVisible, setLeaksPanelVisible] = useState(true);

  // In dev mode, consider authenticated immediately
  const isAuthenticated = SKIP_AUTH || status === 'authenticated';
  const isLoading = !SKIP_AUTH && status === 'loading';

  // Fetch spots from API
  const fetchSpots = useCallback(async () => {
    try {
      const res = await fetch('/api/spots');
      if (res.ok) {
        const data = await res.json();
        setSpots(data);
        return data;
      }
    } catch (error) {
      console.error('Failed to fetch spots:', error);
    }
    return [];
  }, []);

  // Fetch profiles for a specific spot
  const fetchProfiles = useCallback(async (spotId: string) => {
    if (!spotId) {
      setProfiles([]);
      return;
    }

    try {
      const res = await fetch(`/api/profiles?spotId=${spotId}`);
      if (res.ok) {
        const data = await res.json();
        setProfiles(data);

        // Set default selections - prefer GTO profiles initially
        const oopProfiles = data.filter((p: Profile) => p.player === 'OOP');
        const ipProfiles = data.filter((p: Profile) => p.player === 'IP');

        // Find GTO profiles or fall back to first profile
        const defaultOOP = oopProfiles.find((p: Profile) => p.isGto) || oopProfiles[0];
        const defaultIP = ipProfiles.find((p: Profile) => p.isGto) || ipProfiles[0];

        setOOPProfileId(defaultOOP?.id || '');
        setIPProfileId(defaultIP?.id || '');
      }
    } catch (error) {
      console.error('Failed to fetch profiles:', error);
    }
  }, []);

  // Seed and fetch data on mount (only when authenticated)
  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    async function init() {
      // Seed defaults (spots and their profiles)
      await fetch('/api/spots/seed', { method: 'POST' });
      // Then fetch spots
      const spotsData = await fetchSpots();
      // Select first spot and fetch its profiles
      if (spotsData.length > 0) {
        setSelectedSpotId(spotsData[0].id);
        await fetchProfiles(spotsData[0].id);
      }
      setLoading(false);
    }
    init();
  }, [fetchSpots, fetchProfiles, isAuthenticated]);

  // Fetch profiles when spot changes
  useEffect(() => {
    if (selectedSpotId && isAuthenticated) {
      fetchProfiles(selectedSpotId);
    }
  }, [selectedSpotId, fetchProfiles, isAuthenticated]);

  // Initialize sidebar state based on screen size
  useEffect(() => {
    const isDesktop = window.innerWidth >= 768;
    setSidebarCollapsed(!isDesktop);
  }, []);

  const selectedSpot = spots.find((s) => s.id === selectedSpotId);

  // Get GTO profiles (baseline)
  const gtoOOPProfile = profiles.find(p => p.player === 'OOP' && p.isGto);
  const gtoIPProfile = profiles.find(p => p.player === 'IP' && p.isGto);

  // Get selected profiles (what we're comparing against GTO)
  const selectedOOPProfile = profiles.find(p => p.id === oopProfileId);
  const selectedIPProfile = profiles.find(p => p.id === ipProfileId);

  // Filter profiles for display (non-GTO profiles for selection)
  const selectableProfiles = profiles;

  // Node click handler - opens the drawer
  const handleNodeClick = useCallback((node: SelectedNodeData) => {
    setSelectedNode(node);
    setNodeEditorOpened(true);
  }, []);

  // Save node changes from drawer
  const handleSaveNode = useCallback(async (nodeId: string, frequency: number, weakPercent?: number) => {
    if (!selectedNode) return;

    const profile = selectedNode.player === 'OOP' ? selectedOOPProfile : selectedIPProfile;
    if (!profile) return;

    // Update the profile's nodeData
    const { weakPercent: _oldWeak, ...existingNodeData } = profile.nodeData[nodeId] || {};
    const updatedNodeData = {
      ...profile.nodeData,
      [nodeId]: {
        ...existingNodeData,
        frequency,
        ...(weakPercent !== undefined ? { weakPercent } : {}),
      },
    };

    const updatedProfile = {
      ...profile,
      nodeData: updatedNodeData,
    };

    // Optimistically update local state
    setProfiles(prev => prev.map(p => p.id === profile.id ? updatedProfile : p));

    // Save to API
    try {
      await fetch(`/api/profiles/${profile.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedProfile),
      });
    } catch (error) {
      console.error('Failed to save node:', error);
    }
  }, [selectedNode, selectedOOPProfile, selectedIPProfile]);

  // Save sizing changes to spot tree
  const handleSaveSizing = useCallback(async (nodeId: string, sizing: number) => {
    if (!selectedSpot) return;

    const updateSizing = (node: BaseTreeNode): BaseTreeNode => {
      if (node.id === nodeId) {
        return { ...node, sizing };
      }
      return { ...node, children: node.children.map(updateSizing) };
    };

    const updatedTree = updateSizing(selectedSpot.tree as BaseTreeNode);
    const updatedSpot = { ...selectedSpot, tree: updatedTree };

    setSpots(prev => prev.map(s => s.id === selectedSpot.id ? updatedSpot : s));

    try {
      await fetch(`/api/spots/${selectedSpot.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSpot),
      });
    } catch (error) {
      console.error('Failed to save sizing:', error);
    }
  }, [selectedSpot]);

  // Tree editing handlers
  const handleAddNode = useCallback(async (parentId: string, action: string, player: Player, street: string, sizing?: number) => {
    if (!selectedSpot) return;

    // Helper to find and update parent node
    const addChildToNode = (node: BaseTreeNode): BaseTreeNode => {
      if (node.id === parentId) {
        const newNode: BaseTreeNode = {
          id: `${parentId}-${action}-${Date.now()}`,
          action: action as BaseTreeNode['action'],
          player: player,
          street: street as BaseTreeNode['street'],
          ...(sizing !== undefined && { sizing }),
          children: [],
        };
        return {
          ...node,
          children: [...node.children, newNode],
        };
      }
      return {
        ...node,
        children: node.children.map(addChildToNode),
      };
    };

    const updatedTree = addChildToNode(selectedSpot.tree as BaseTreeNode);
    const updatedSpot = { ...selectedSpot, tree: updatedTree };

    // Update local state
    setSpots(prev => prev.map(s => s.id === selectedSpot.id ? updatedSpot : s));

    // Save to API
    try {
      await fetch(`/api/spots/${selectedSpot.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSpot),
      });
    } catch (error) {
      console.error('Failed to add node:', error);
    }
  }, [selectedSpot]);

  const handleDeleteNode = useCallback(async (nodeId: string) => {
    if (!selectedSpot) return;

    // Don't allow deleting the root node
    if ((selectedSpot.tree as BaseTreeNode).id === nodeId) {
      alert("Cannot delete the root node");
      return;
    }

    // Helper to remove node from tree
    const removeNode = (node: BaseTreeNode): BaseTreeNode => {
      return {
        ...node,
        children: node.children
          .filter(child => child.id !== nodeId)
          .map(removeNode),
      };
    };

    const updatedTree = removeNode(selectedSpot.tree as BaseTreeNode);
    const updatedSpot = { ...selectedSpot, tree: updatedTree };

    // Update local state
    setSpots(prev => prev.map(s => s.id === selectedSpot.id ? updatedSpot : s));

    // Save to API
    try {
      await fetch(`/api/spots/${selectedSpot.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSpot),
      });
    } catch (error) {
      console.error('Failed to delete node:', error);
    }
  }, [selectedSpot]);

  // Apply profiles to the tree
  const processedTree = useMemo(() => {
    if (!selectedSpot || !gtoOOPProfile || !gtoIPProfile || !selectedOOPProfile || !selectedIPProfile) {
      return null;
    }
    return applyProfilesToTree(
      selectedSpot.tree as BaseTreeNode,
      { OOP: gtoOOPProfile, IP: gtoIPProfile },
      { OOP: selectedOOPProfile, IP: selectedIPProfile }
    );
  }, [selectedSpot, gtoOOPProfile, gtoIPProfile, selectedOOPProfile, selectedIPProfile]);

  // Create a modified spot with the processed tree for display
  const processedSpot: ProcessedSpot | null = useMemo(() => {
    if (!selectedSpot || !processedTree) return null;
    return {
      ...selectedSpot,
      potSize: selectedSpot.potSize ?? 6.5,
      oopCombos: selectedSpot.oopCombos ?? 100,
      ipCombos: selectedSpot.ipCombos ?? 100,
      tree: processedTree,
    };
  }, [selectedSpot, processedTree]);

  // Profile handlers
  const handleEditProfile = (profile: Profile) => {
    setEditingProfile(profile);
    setEditorPlayer(profile.player);
    setProfileEditorOpened(true);
  };

  const handleCreateProfile = (player: Player) => {
    setEditingProfile(null);
    setEditorPlayer(player);
    setProfileEditorOpened(true);
  };

  const handleSaveProfile = async (profile: Omit<Profile, 'spotId'>) => {
    try {
      const isNew = !editingProfile;
      const url = isNew ? '/api/profiles' : `/api/profiles/${profile.id}`;
      const method = isNew ? 'POST' : 'PUT';

      // Include spotId for new profiles
      const body = { ...profile, spotId: selectedSpotId };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const savedProfile = await res.json();

        setProfiles(prev => {
          if (isNew) {
            return [...prev, savedProfile];
          } else {
            return prev.map(p => p.id === savedProfile.id ? savedProfile : p);
          }
        });

        if (savedProfile.player === 'OOP') {
          setOOPProfileId(savedProfile.id);
        } else {
          setIPProfileId(savedProfile.id);
        }
      }
    } catch (error) {
      console.error('Failed to save profile:', error);
    }
  };

  // Spot handlers
  const handleEditSpot = (spot: Spot) => {
    setEditingSpot(spot);
    setSpotEditorOpened(true);
  };

  const handleCreateSpot = () => {
    setEditingSpot(null);
    setSpotEditorOpened(true);
  };

  const handleDeleteSpot = async (spotId: string) => {
    try {
      const res = await fetch(`/api/spots/${spotId}`, { method: 'DELETE' });
      if (res.ok) {
        setSpots(prev => prev.filter(s => s.id !== spotId));
        // If deleted spot was selected, select another one
        if (selectedSpotId === spotId) {
          const remaining = spots.filter(s => s.id !== spotId);
          setSelectedSpotId(remaining.length > 0 ? remaining[0].id : '');
        }
      }
    } catch (error) {
      console.error('Failed to delete spot:', error);
    }
  };

  const handleSaveSpot = async (spot: Spot) => {
    try {
      const isNew = !editingSpot;
      const url = isNew ? '/api/spots' : `/api/spots/${spot.id}`;
      const method = isNew ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(spot),
      });

      if (res.ok) {
        const savedSpot = await res.json();

        setSpots(prev => {
          if (isNew) {
            return [...prev, savedSpot];
          } else {
            return prev.map(s => s.id === savedSpot.id ? savedSpot : s);
          }
        });

        // Select the saved spot
        setSelectedSpotId(savedSpot.id);
      }
    } catch (error) {
      console.error('Failed to save spot:', error);
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <Center h="100vh">
        <LoadingOverlay visible={true} zIndex={1000} overlayProps={{ blur: 2 }} />
      </Center>
    );
  }

  // Show sign-in page when not authenticated
  if (!isAuthenticated) {
    return (
      <Center h="100vh" className="login-bg">
        <Paper shadow="xl" radius="md" p={40} className="login-card">
          <Stack align="center" gap="xl">
            <Stack align="center" gap="xs" mt="md">
              <IconSitemap size={64} color="white" />
              <Title order={1} c="white">Tree</Title>
            </Stack>
            <Divider label="Login" labelPosition="center" w="100%" color="dark.4" />
            <Button
              size="lg"
              fullWidth
              onClick={() => signIn('discord')}
              className="discord-btn"
              leftSection={
                <svg width="20" height="15" viewBox="0 0 127.14 96.36" fill="currentColor">
                  <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
                </svg>
              }
            >
              Sign in with Discord
            </Button>
          </Stack>
        </Paper>
      </Center>
    );
  }

  return (
    <AppShell
      navbar={{
        width: 280,
        breakpoint: 'sm',
        collapsed: { desktop: sidebarCollapsed, mobile: !mobileNavOpened },
      }}
      padding={0}
    >
      <AppShell.Navbar style={{ display: 'flex', flexDirection: 'column' }}>
        <ScrollArea style={{ flex: 1 }}>
          <Sidebar
            spots={spots}
            selectedSpotId={selectedSpotId}
            onSelectSpot={(id) => {
              setSelectedSpotId(id);
              setMobileNavOpened(false);
            }}
            onEditSpot={handleEditSpot}
            onDeleteSpot={handleDeleteSpot}
            onCreateSpot={handleCreateSpot}
            onClose={() => setMobileNavOpened(false)}
          />
        </ScrollArea>
        <AuthButton />
      </AppShell.Navbar>

      <AppShell.Main style={{ height: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
        <LoadingOverlay visible={loading} zIndex={1000} overlayProps={{ blur: 2 }} />
        {processedSpot ? (
          <>
            <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
              <TreeView
                spot={processedSpot}
                onNodeClick={handleNodeClick}
                sidebarCollapsed={sidebarCollapsed}
                onToggleSidebar={() => {
                  // On mobile (< sm breakpoint), toggle mobile nav
                  // On desktop, toggle sidebar collapse
                  if (window.innerWidth < 768) {
                    setMobileNavOpened(!mobileNavOpened);
                  } else {
                    setSidebarCollapsed(!sidebarCollapsed);
                  }
                }}
                profiles={selectableProfiles}
                oopProfileId={oopProfileId}
                ipProfileId={ipProfileId}
                onOOPProfileChange={setOOPProfileId}
                onIPProfileChange={setIPProfileId}
                onEditProfile={handleEditProfile}
                onCreateProfile={handleCreateProfile}
                editMode={treeEditMode}
                onToggleEditMode={() => setTreeEditMode(!treeEditMode)}
                onAddNode={handleAddNode}
                onDeleteNode={handleDeleteNode}
              />
            </div>
            <LeaksTable
              tree={processedSpot.tree}
              initialPotSize={processedSpot.potSize}
              initialOopCombos={processedSpot.oopCombos}
              initialIpCombos={processedSpot.ipCombos}
              visible={leaksPanelVisible}
              onToggleVisible={() => setLeaksPanelVisible(!leaksPanelVisible)}
            />
          </>
        ) : (
          <Center h="100%">
            <Text c="dimmed">
              {loading ? 'Loading...' : spots.length === 0 ? 'Create a spot to get started' : 'Select a spot to view its tree'}
            </Text>
          </Center>
        )}
      </AppShell.Main>

      {selectedSpot && gtoOOPProfile && gtoIPProfile && (
        <ProfileEditor
          opened={profileEditorOpened}
          onClose={() => setProfileEditorOpened(false)}
          profile={editingProfile}
          gtoProfile={editorPlayer === 'OOP' ? gtoOOPProfile : gtoIPProfile}
          tree={selectedSpot.tree as BaseTreeNode}
          onSave={handleSaveProfile}
          player={editorPlayer}
        />
      )}

      <SpotEditor
        opened={spotEditorOpened}
        onClose={() => setSpotEditorOpened(false)}
        spot={editingSpot}
        onSave={handleSaveSpot}
      />

      <NodeEditor
        opened={nodeEditorOpened}
        onClose={() => setNodeEditorOpened(false)}
        node={selectedNode}
        onSave={handleSaveNode}
        onSaveSizing={handleSaveSizing}
      />
    </AppShell>
  );
}
