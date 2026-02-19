'use client';

import { useMemo, useCallback, useState, useEffect } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  EdgeProps,
  Position,
  ConnectionLineType,
  Panel,
  useInternalNode,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ProcessedSpot, TreeNode as TreeNodeType, actionLabels, streetLabels, Profile, Player, Action, Street } from '@/types';
import { ActionNode } from './ActionNode';
import { IconLock, IconLockOpen, IconZoomReset } from '@tabler/icons-react';
import { modals } from '@mantine/modals';
import { Text } from '@mantine/core';

const EDGE_RADIUS = 8;

function TreeEdge({ id, source, target, style }: EdgeProps) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);

  if (!sourceNode || !targetNode) return null;

  const sx = sourceNode.internals.positionAbsolute.x + (sourceNode.measured.width ?? 0) / 2;
  const sy = sourceNode.internals.positionAbsolute.y + (sourceNode.measured.height ?? 0);
  const tx = targetNode.internals.positionAbsolute.x + (targetNode.measured.width ?? 0) / 2;
  const ty = targetNode.internals.positionAbsolute.y;

  const midY = (sy + ty) / 2;
  const dx = tx - sx;
  const r = Math.min(EDGE_RADIUS, Math.abs(dx) / 2, Math.abs(ty - sy) / 4);

  let d: string;
  if (Math.abs(dx) < 1) {
    // Straight vertical line
    d = `M ${sx} ${sy} L ${tx} ${ty}`;
  } else {
    // Down, turn, horizontal, turn, down
    const sign = dx > 0 ? 1 : -1;
    d = [
      `M ${sx} ${sy}`,
      `L ${sx} ${midY - r}`,
      `Q ${sx} ${midY} ${sx + sign * r} ${midY}`,
      `L ${tx - sign * r} ${midY}`,
      `Q ${tx} ${midY} ${tx} ${midY + r}`,
      `L ${tx} ${ty}`,
    ].join(' ');
  }

  return (
    <path
      id={id}
      d={d}
      fill="none"
      style={style}
      className="react-flow__edge-path"
    />
  );
}

const nodeTypes = {
  action: ActionNode,
};

const edgeTypes = {
  tree: TreeEdge,
};

interface TreeToolbarProps {
  onToggleSidebar?: () => void;
  sidebarCollapsed?: boolean;
  profiles: Profile[];
  oopProfileId?: string;
  ipProfileId?: string;
  onOOPProfileChange?: (profileId: string) => void;
  onIPProfileChange?: (profileId: string) => void;
  onEditProfile?: (profile: Profile) => void;
  onCreateProfile?: (player: Player) => void;
  onExportProfile?: (profile: Profile) => void;
  onImportProfile?: (player: Player) => void;
  editMode?: boolean;
  onToggleEditMode?: () => void;
  spotId: string;
}

function TreeToolbar({
  onToggleSidebar,
  sidebarCollapsed,
  profiles,
  oopProfileId,
  ipProfileId,
  onOOPProfileChange,
  onIPProfileChange,
  onEditProfile,
  onCreateProfile,
  onExportProfile,
  onImportProfile,
  editMode,
  onToggleEditMode,
}: TreeToolbarProps) {
  const { fitView } = useReactFlow();
  const oopProfiles = profiles.filter(p => p.player === 'OOP');
  const ipProfiles = profiles.filter(p => p.player === 'IP');
  const selectedOOP = oopProfiles.find(p => p.id === oopProfileId);
  const selectedIP = ipProfiles.find(p => p.id === ipProfileId);

  return (
    <Panel position="top-left" className="tree-panels">
      {onToggleSidebar && (
        <button
          className="sidebar-toggle-btn"
          onClick={onToggleSidebar}
          title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
        >
          {sidebarCollapsed ? '☰' : '«'}
        </button>
      )}
      <button
        className="sidebar-toggle-btn"
        onClick={() => fitView({ duration: 400, padding: 0.2 })}
        title="Reset zoom"
      >
        <IconZoomReset size={18} />
      </button>
      <div className="legend-panel">
        <div className="legend-section">
          <span className="legend-section-label">Leaks:</span>
          <div className="legend-item">
            <div className="legend-color overfold" />
            <span>Overfold</span>
          </div>
          <div className="legend-item">
            <div className="legend-color underfold" />
            <span>Underfold</span>
          </div>
          <div className="legend-item">
            <div className="legend-color overbluff" />
            <span>Overbluff</span>
          </div>
          <div className="legend-item">
            <div className="legend-color underbluff" />
            <span>Underbluff</span>
          </div>
        </div>
        <div className="legend-divider" />
        <div className="legend-section">
          <span className="legend-section-label">Exploits:</span>
          <div className="legend-item">
            <div className="legend-color missed-exploit" />
            <span>Missed</span>
          </div>
          <div className="legend-item">
            <div className="legend-color exploiting" />
            <span>Exploiting</span>
          </div>
        </div>
      </div>
      {profiles.length > 0 && (
        <div className="profiles-panel">
          <div className="profile-row">
            <span className="profile-badge oop">OOP</span>
            <select
              className="profile-select"
              value={oopProfileId || ''}
              onChange={(e) => onOOPProfileChange?.(e.target.value)}
            >
              {oopProfiles.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <button
              className="profile-menu-btn"
              onClick={() => selectedOOP && onEditProfile?.(selectedOOP)}
              title="Edit profile"
            >
              ✎
            </button>
            <button
              className="profile-menu-btn"
              onClick={() => onCreateProfile?.('OOP')}
              title="New profile"
            >
              +
            </button>
            {onExportProfile && selectedOOP && (
              <button
                className="profile-menu-btn"
                onClick={() => onExportProfile(selectedOOP)}
                title="Export profile"
              >
                ↓
              </button>
            )}
            {onImportProfile && (
              <button
                className="profile-menu-btn"
                onClick={() => onImportProfile('OOP')}
                title="Import profile"
              >
                ↑
              </button>
            )}
          </div>
          <div className="profile-row">
            <span className="profile-badge ip">IP</span>
            <select
              className="profile-select"
              value={ipProfileId || ''}
              onChange={(e) => onIPProfileChange?.(e.target.value)}
            >
              {ipProfiles.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <button
              className="profile-menu-btn"
              onClick={() => selectedIP && onEditProfile?.(selectedIP)}
              title="Edit profile"
            >
              ✎
            </button>
            <button
              className="profile-menu-btn"
              onClick={() => onCreateProfile?.('IP')}
              title="New profile"
            >
              +
            </button>
            {onExportProfile && selectedIP && (
              <button
                className="profile-menu-btn"
                onClick={() => onExportProfile(selectedIP)}
                title="Export profile"
              >
                ↓
              </button>
            )}
            {onImportProfile && (
              <button
                className="profile-menu-btn"
                onClick={() => onImportProfile('IP')}
                title="Import profile"
              >
                ↑
              </button>
            )}
          </div>
        </div>
      )}
      {onToggleEditMode && (
        <button
          className={`edit-mode-btn ${editMode ? 'active' : ''}`}
          onClick={onToggleEditMode}
          title={editMode ? 'Lock tree' : 'Edit tree'}
        >
          {editMode ? <IconLockOpen size={18} /> : <IconLock size={18} />}
        </button>
      )}
    </Panel>
  );
}

function NodeFocuser({ target, spotId }: { target: { nodeId: string; timestamp: number } | null; spotId: string }) {
  const { fitView } = useReactFlow();

  useEffect(() => {
    fitView({ duration: 400, padding: 0.2 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spotId]);

  useEffect(() => {
    if (!target) return;
    fitView({ nodes: [{ id: target.nodeId }], duration: 600, padding: 0.5, maxZoom: 1.2 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.nodeId, target?.timestamp]);

  return null;
}

export interface SelectedNodeData {
  nodeId: string;
  player: 'OOP' | 'IP';
  action: string;
  frequency: number;
  gtoFrequency: number;
  weakPercent?: number;
  gtoWeakPercent?: number;
  sizing?: number;
}

interface TreeViewProps {
  spot: ProcessedSpot;
  onNodeClick?: (node: SelectedNodeData) => void;
  sidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  profiles?: Profile[];
  oopProfileId?: string;
  ipProfileId?: string;
  onOOPProfileChange?: (profileId: string) => void;
  onIPProfileChange?: (profileId: string) => void;
  onEditProfile?: (profile: Profile) => void;
  onCreateProfile?: (player: Player) => void;
  onExportProfile?: (profile: Profile) => void;
  onImportProfile?: (player: Player) => void;
  editMode?: boolean;
  onToggleEditMode?: () => void;
  onAddNode?: (parentId: string, action: string, player: 'OOP' | 'IP', street: string, sizing?: number) => void;
  onDeleteNode?: (nodeId: string) => void;
  onDeleteNodeKeepChildren?: (nodeId: string) => void;
  onUpdateNode?: (nodeId: string, action: Action, player: Player, street: Street, sizing?: number) => void;
  onAddParentNode?: (action: Action, player: Player, street: Street, sizing?: number) => void;
  focusTarget?: { nodeId: string; timestamp: number } | null;
}

interface LayoutResult {
  nodes: Node[];
  edges: Edge[];
}

function layoutTree(root: TreeNodeType, initialPotSize: number, initialOopCombos: number, initialIpCombos: number): LayoutResult {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const nodeWidth = 340;
  const nodeHeight = 115;
  const horizontalSpacing = 40;
  const verticalSpacing = 60;

  // First pass: calculate subtree widths
  function getSubtreeWidth(node: TreeNodeType): number {
    if (node.children.length === 0) {
      return nodeWidth;
    }
    const childrenWidth = node.children.reduce(
      (sum, child) => sum + getSubtreeWidth(child) + horizontalSpacing,
      -horizontalSpacing
    );
    return Math.max(nodeWidth, childrenWidth);
  }

  // Track overbluffs by player to detect passive exploits
  interface OverbluffState {
    OOP: boolean;
    IP: boolean;
  }

  // Calculate pot after an action
  // pot: current pot before action
  // facingBet: amount the player faces (0 if no bet to call)
  // Returns: { newPot, newFacingBet }
  function calculatePot(
    action: string,
    pot: number,
    facingBet: number,
    sizing?: number
  ): { newPot: number; newFacingBet: number; actionAmount: number } {
    switch (action) {
      case 'bet': {
        const betAmount = pot * (sizing || 50) / 100;
        return { newPot: pot + betAmount, newFacingBet: betAmount, actionAmount: betAmount };
      }
      case 'raise': {
        // Raise to sizing * facingBet (e.g., 3x = raise to 3 times the facing bet)
        const multiplier = sizing || 3;
        const raiseTotal = multiplier * facingBet; // total hero puts in
        const newFacing = raiseTotal - facingBet;  // additional amount opponent must call
        return { newPot: pot + raiseTotal, newFacingBet: newFacing, actionAmount: raiseTotal };
      }
      case 'call': {
        return { newPot: pot + facingBet, newFacingBet: 0, actionAmount: facingBet };
      }
      case 'check':
      case 'fold':
      default:
        return { newPot: pot, newFacingBet: 0, actionAmount: 0 };
    }
  }

  // Second pass: position nodes
  function positionNode(
    node: TreeNodeType,
    x: number,
    y: number,
    parentId?: string,
    parentReach: number = 1,
    opponentOverbluffs: OverbluffState = { OOP: false, IP: false },
    pot: number = initialPotSize,
    facingBet: number = 0,
    parentOopCombos: number = initialOopCombos,
    parentIpCombos: number = initialIpCombos,
    oopPath: string[] = [],
    ipPath: string[] = []
  ) {
    const subtreeWidth = getSubtreeWidth(node);
    const nodeX = x + subtreeWidth / 2 - nodeWidth / 2;

    // Reach probability: how often we arrive at this decision point (excludes this node's own frequency)
    const reachProbability = parentReach;
    // What to pass to children: how often this node's action was taken
    const childReach = parentReach * node.frequency;

    // Calculate combos: acting player's combos reduce by their frequency
    const oopCombos = node.player === 'OOP' ? parentOopCombos * node.frequency : parentOopCombos;
    const ipCombos = node.player === 'IP' ? parentIpCombos * node.frequency : parentIpCombos;

    // Calculate pot after this action
    const { newPot, newFacingBet, actionAmount } = calculatePot(node.action, pot, facingBet, node.sizing);

    // Build the display label for this node (with sizing suffix)
    const nodeLabel = actionLabels[node.action];
    const hasSizing = (node.action === 'bet' || node.action === 'raise') && node.sizing !== undefined;
    const nodeDisplayLabel = hasSizing
      ? node.action === 'raise' ? `${nodeLabel}${node.sizing}X` : `${nodeLabel}${node.sizing}`
      : nodeLabel;

    // Only append this action to the acting player's path, mirroring LeaksTable logic
    const newOopPath = node.player === 'OOP' ? [...oopPath, nodeDisplayLabel] : oopPath;
    const newIpPath = node.player === 'IP' ? [...ipPath, nodeDisplayLabel] : ipPath;
    const playerPath = node.player === 'OOP' ? newOopPath : newIpPath;

    // Check for fold leaks
    const isOverfold = node.action === 'fold' && node.frequency > node.gtoFrequency;
    const isUnderfold = node.action === 'fold' && node.frequency < node.gtoFrequency;

    // Check for overbluffs/underbluffs (B/R nodes with weak% vs gtoWeak%)
    const isOverbluff = (node.action === 'bet' || node.action === 'raise') &&
      node.weakPercent !== undefined &&
      node.gtoWeakPercent !== undefined &&
      node.weakPercent > node.gtoWeakPercent;
    const isUnderbluff = (node.action === 'bet' || node.action === 'raise') &&
      node.weakPercent !== undefined &&
      node.gtoWeakPercent !== undefined &&
      node.weakPercent < node.gtoWeakPercent;

    // Check for passive exploits: fold decisions after opponent overbluffs
    const opponent = node.player === 'OOP' ? 'IP' : 'OOP';
    const opponentHasOverbluffed = opponentOverbluffs[opponent];

    // Overfold after opponent overbluff = missed exploit (we should call more)
    const isMissedExploit = isOverfold && opponentHasOverbluffed;
    // Underfold after opponent overbluff = exploiting (we're calling more correctly)
    const isExploiting = isUnderfold && opponentHasOverbluffed;

    nodes.push({
      id: node.id,
      type: 'action',
      position: { x: nodeX, y },
      data: {
        nodeId: node.id,
        label: actionLabels[node.action],
        action: node.action,
        player: node.player,
        street: streetLabels[node.street],
        rawStreet: node.street,
        frequency: node.frequency,
        gtoFrequency: node.gtoFrequency,
        weakPercent: node.weakPercent,
        gtoWeakPercent: node.gtoWeakPercent,
        reachProbability,
        isOverfold,
        isUnderfold,
        isOverbluff,
        isUnderbluff,
        isMissedExploit,
        isExploiting,
        hasChildren: node.children.length > 0,
        potSize: newPot,
        sizing: node.sizing,
        actionAmount,
        oopCombos,
        ipCombos,
        line: playerPath.join(' → '),
      },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
    });

    if (parentId) {
      edges.push({
        id: `${parentId}-${node.id}`,
        source: parentId,
        target: node.id,
        type: 'tree',
        style: { stroke: '#4a4d52', strokeWidth: 2 },
      });
    }

    // Update overbluff tracking for children
    const newOverbluffs: OverbluffState = {
      ...opponentOverbluffs,
      [node.player]: opponentOverbluffs[node.player as keyof OverbluffState] || isOverbluff,
    };

    // Position children
    let childX = x;
    for (const child of node.children) {
      const childWidth = getSubtreeWidth(child);
      positionNode(
        child,
        childX,
        y + nodeHeight + verticalSpacing,
        node.id,
        childReach,
        newOverbluffs,
        newPot,
        newFacingBet,
        oopCombos,
        ipCombos,
        newOopPath,
        newIpPath
      );
      childX += childWidth + horizontalSpacing;
    }
  }

  positionNode(root, 0, 0, undefined, 1, { OOP: false, IP: false }, initialPotSize, 0);

  return { nodes, edges };
}

export function TreeView({
  spot,
  onNodeClick,
  sidebarCollapsed,
  onToggleSidebar,
  profiles = [],
  oopProfileId,
  ipProfileId,
  onOOPProfileChange,
  onIPProfileChange,
  onEditProfile,
  onCreateProfile,
  onExportProfile,
  onImportProfile,
  editMode = false,
  onToggleEditMode,
  onAddNode,
  onDeleteNode,
  onDeleteNodeKeepChildren,
  onUpdateNode,
  onAddParentNode,
  focusTarget,
}: TreeViewProps) {
  const { nodes, edges } = useMemo(() => layoutTree(spot.tree, spot.potSize, spot.oopCombos, spot.ipCombos), [spot.tree, spot.potSize, spot.oopCombos, spot.ipCombos]);

  // Edit mode state
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newNodeAction, setNewNodeAction] = useState<Action>('bet');
  const [newNodePlayer, setNewNodePlayer] = useState<Player>('OOP');
  const [newNodeStreet, setNewNodeStreet] = useState<Street>('flop');
  const [newNodeSizing, setNewNodeSizing] = useState<number>(50);

  // Edit current node state
  const [editNodeAction, setEditNodeAction] = useState<Action>('bet');
  const [editNodePlayer, setEditNodePlayer] = useState<Player>('OOP');
  const [editNodeStreet, setEditNodeStreet] = useState<Street>('flop');
  const [editNodeSizing, setEditNodeSizing] = useState<number>(50);

  // Add parent node state
  const [parentNodeAction, setParentNodeAction] = useState<Action>('bet');
  const [parentNodePlayer, setParentNodePlayer] = useState<Player>('OOP');
  const [parentNodeStreet, setParentNodeStreet] = useState<Street>('flop');
  const [parentNodeSizing, setParentNodeSizing] = useState<number>(50);

  // Modal tab state
  const [modalTab, setModalTab] = useState<'edit' | 'add-child' | 'add-parent'>('edit');

  // Find the node being edited to get its info
  const editingNodeData = editingNodeId ? nodes.find(n => n.id === editingNodeId)?.data : null;

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (editMode && onAddNode) {
      // In edit mode, show the add/delete options
      const data = node.data as { player: 'OOP' | 'IP'; street: string; rawStreet: Street; action: string; sizing?: number };
      setEditingNodeId(node.id);
      // Default new child to opposite player, same street
      setNewNodePlayer(data.player === 'OOP' ? 'IP' : 'OOP');
      setNewNodeStreet(data.rawStreet || 'flop');
      // Pre-populate edit fields with current node values
      setEditNodeAction((data.action as Action) || 'bet');
      setEditNodePlayer(data.player);
      setEditNodeStreet(data.rawStreet || 'flop');
      setEditNodeSizing(data.sizing ?? 50);
      setModalTab('edit');
      setShowAddModal(true);
    } else if (onNodeClick && node.data) {
      const data = node.data as {
        nodeId: string;
        player: 'OOP' | 'IP';
        action: string;
        frequency: number;
        gtoFrequency: number;
        weakPercent?: number;
        gtoWeakPercent?: number;
        sizing?: number;
      };
      onNodeClick({
        nodeId: data.nodeId,
        player: data.player,
        action: data.action,
        frequency: data.frequency,
        gtoFrequency: data.gtoFrequency,
        weakPercent: data.weakPercent,
        gtoWeakPercent: data.gtoWeakPercent,
        sizing: data.sizing,
      });
    }
  }, [editMode, onNodeClick, onAddNode]);

  const handleAddNode = () => {
    if (editingNodeId && onAddNode) {
      const sizing = (newNodeAction === 'bet' || newNodeAction === 'raise') ? newNodeSizing : undefined;
      onAddNode(editingNodeId, newNodeAction, newNodePlayer, newNodeStreet, sizing);
      setShowAddModal(false);
      setEditingNodeId(null);
    }
  };

  const handleUpdateNode = () => {
    if (editingNodeId && onUpdateNode) {
      const sizing = (editNodeAction === 'bet' || editNodeAction === 'raise') ? editNodeSizing : undefined;
      onUpdateNode(editingNodeId, editNodeAction, editNodePlayer, editNodeStreet, sizing);
      setShowAddModal(false);
      setEditingNodeId(null);
    }
  };

  const handleDeleteNode = () => {
    if (!editingNodeId || !onDeleteNode) return;
    const id = editingNodeId;
    modals.openConfirmModal({
      title: 'Delete subtree',
      children: <Text size="sm">This will remove the node and all nodes beneath it. This cannot be undone.</Text>,
      labels: { confirm: 'Delete subtree', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => {
        onDeleteNode(id);
        setShowAddModal(false);
        setEditingNodeId(null);
      },
    });
  };

  const handleDeleteNodeKeepChildren = () => {
    if (!editingNodeId || !onDeleteNodeKeepChildren) return;
    const id = editingNodeId;
    modals.openConfirmModal({
      title: 'Delete node',
      children: <Text size="sm">This will remove the node and promote its children up to its parent.</Text>,
      labels: { confirm: 'Delete node', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => {
        onDeleteNodeKeepChildren(id);
        setShowAddModal(false);
        setEditingNodeId(null);
      },
    });
  };

  const isEditingRoot = editingNodeId === spot.tree.id;
  // Can only delete-keep-children on root if it has exactly one child (unambiguous promotion)
  const canDeleteKeepChildren = !isEditingRoot || spot.tree.children.length === 1;

  const handleAddParentNode = () => {
    if (onAddParentNode) {
      const sizing = (parentNodeAction === 'bet' || parentNodeAction === 'raise') ? parentNodeSizing : undefined;
      onAddParentNode(parentNodeAction, parentNodePlayer, parentNodeStreet, sizing);
      setShowAddModal(false);
      setEditingNodeId(null);
    }
  };

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionLineType={ConnectionLineType.SmoothStep}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={true}
        onNodeClick={handleNodeClick}
        panOnDrag
        zoomOnScroll
        minZoom={0.2}
        maxZoom={2}
      >
        <TreeToolbar
          spotId={spot.id}
          onToggleSidebar={onToggleSidebar}
          sidebarCollapsed={sidebarCollapsed}
          profiles={profiles}
          oopProfileId={oopProfileId}
          ipProfileId={ipProfileId}
          onOOPProfileChange={onOOPProfileChange}
          onIPProfileChange={onIPProfileChange}
          onEditProfile={onEditProfile}
          onCreateProfile={onCreateProfile}
          onExportProfile={onExportProfile}
          onImportProfile={onImportProfile}
          editMode={editMode}
          onToggleEditMode={onToggleEditMode}
        />

        <NodeFocuser target={focusTarget ?? null} spotId={spot.id} />
      </ReactFlow>

      {/* Edit mode modal - rendered outside ReactFlow to avoid stacking context issues */}
      {showAddModal && editingNodeId && (
        <div className="edit-modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="edit-modal-header">
              <div className="edit-modal-tabs">
                <button
                  className={`edit-modal-tab ${modalTab === 'edit' ? 'active' : ''}`}
                  onClick={() => setModalTab('edit')}
                >
                  Edit
                </button>
                <button
                  className={`edit-modal-tab ${modalTab === 'add-child' ? 'active' : ''}`}
                  onClick={() => setModalTab('add-child')}
                >
                  Add Child
                </button>
                {isEditingRoot && onAddParentNode && (
                  <button
                    className={`edit-modal-tab ${modalTab === 'add-parent' ? 'active' : ''}`}
                    onClick={() => setModalTab('add-parent')}
                  >
                    Add Parent
                  </button>
                )}
              </div>
              <button className="edit-modal-close" onClick={() => setShowAddModal(false)}>×</button>
            </div>

            <div className="edit-modal-content">
              {modalTab === 'edit' && (
                <>
                  <div className="edit-modal-section">
                    <div className="edit-modal-field">
                      <label>Action</label>
                      <select className="edit-modal-select" value={editNodeAction} onChange={(e) => setEditNodeAction(e.target.value as Action)}>
                        <option value="bet">Bet</option>
                        <option value="check">Check</option>
                        <option value="raise">Raise</option>
                        <option value="call">Call</option>
                        <option value="fold">Fold</option>
                      </select>
                    </div>
                    <div className="edit-modal-field">
                      <label>Player</label>
                      <select className="edit-modal-select" value={editNodePlayer} onChange={(e) => setEditNodePlayer(e.target.value as Player)}>
                        <option value="OOP">OOP</option>
                        <option value="IP">IP</option>
                      </select>
                    </div>
                    <div className="edit-modal-field">
                      <label>Street</label>
                      <select className="edit-modal-select" value={editNodeStreet} onChange={(e) => setEditNodeStreet(e.target.value as Street)}>
                        <option value="flop">Flop</option>
                        <option value="turn">Turn</option>
                        <option value="river">River</option>
                      </select>
                    </div>
                    {editNodeAction === 'raise' && (
                      <div className="edit-modal-field">
                        <label>Raise size (x facing bet)</label>
                        <input type="number" className="edit-modal-input" value={editNodeSizing} onChange={(e) => setEditNodeSizing(Number(e.target.value) || 3)} min={2} max={100} step={0.5} />
                      </div>
                    )}
                    {editNodeAction === 'bet' && (
                      <div className="edit-modal-field">
                        <label>Bet size (% of pot)</label>
                        <input type="number" className="edit-modal-input" value={editNodeSizing} onChange={(e) => setEditNodeSizing(Number(e.target.value) || 50)} min={1} max={500} step={25} />
                      </div>
                    )}
                  </div>
                  <div className="edit-modal-actions">
                    <button className="edit-modal-btn save" onClick={handleUpdateNode} disabled={!onUpdateNode}>Update</button>
                    <button className="edit-modal-btn delete" onClick={handleDeleteNodeKeepChildren} disabled={!onDeleteNodeKeepChildren || !canDeleteKeepChildren} title="Remove this node, promoting its children up">Delete node</button>
                    <button className="edit-modal-btn delete" onClick={handleDeleteNode} disabled={!onDeleteNode || isEditingRoot} title="Remove this node and everything beneath it">Delete subtree</button>
                  </div>
                </>
              )}

              {modalTab === 'add-child' && (
                <>
                  <div className="edit-modal-section">
                    <div className="edit-modal-field">
                      <label>Action</label>
                      <select className="edit-modal-select" value={newNodeAction} onChange={(e) => setNewNodeAction(e.target.value as Action)}>
                        <option value="bet">Bet</option>
                        <option value="check">Check</option>
                        <option value="raise">Raise</option>
                        <option value="call">Call</option>
                        <option value="fold">Fold</option>
                      </select>
                    </div>
                    <div className="edit-modal-field">
                      <label>Player</label>
                      <select className="edit-modal-select" value={newNodePlayer} onChange={(e) => setNewNodePlayer(e.target.value as Player)}>
                        <option value="OOP">OOP</option>
                        <option value="IP">IP</option>
                      </select>
                    </div>
                    <div className="edit-modal-field">
                      <label>Street</label>
                      <select className="edit-modal-select" value={newNodeStreet} onChange={(e) => setNewNodeStreet(e.target.value as Street)}>
                        <option value="flop">Flop</option>
                        <option value="turn">Turn</option>
                        <option value="river">River</option>
                      </select>
                    </div>
                    {newNodeAction === 'raise' && (
                      <div className="edit-modal-field">
                        <label>Raise size (x facing bet)</label>
                        <input type="number" className="edit-modal-input" value={newNodeSizing} onChange={(e) => setNewNodeSizing(Number(e.target.value) || 3)} min={2} max={100} step={0.5} />
                      </div>
                    )}
                    {newNodeAction === 'bet' && (
                      <div className="edit-modal-field">
                        <label>Bet size (% of pot)</label>
                        <input type="number" className="edit-modal-input" value={newNodeSizing} onChange={(e) => setNewNodeSizing(Number(e.target.value) || 50)} min={1} max={500} step={25} />
                      </div>
                    )}
                  </div>
                  <div className="edit-modal-actions">
                    <button className="edit-modal-btn save" onClick={handleAddNode} disabled={!onAddNode}>Add Child</button>
                  </div>
                </>
              )}

              {modalTab === 'add-parent' && isEditingRoot && onAddParentNode && (
                <>
                  <div className="edit-modal-section">
                    <div className="edit-modal-field">
                      <label>Action</label>
                      <select className="edit-modal-select" value={parentNodeAction} onChange={(e) => setParentNodeAction(e.target.value as Action)}>
                        <option value="bet">Bet</option>
                        <option value="check">Check</option>
                        <option value="raise">Raise</option>
                        <option value="call">Call</option>
                        <option value="fold">Fold</option>
                      </select>
                    </div>
                    <div className="edit-modal-field">
                      <label>Player</label>
                      <select className="edit-modal-select" value={parentNodePlayer} onChange={(e) => setParentNodePlayer(e.target.value as Player)}>
                        <option value="OOP">OOP</option>
                        <option value="IP">IP</option>
                      </select>
                    </div>
                    <div className="edit-modal-field">
                      <label>Street</label>
                      <select className="edit-modal-select" value={parentNodeStreet} onChange={(e) => setParentNodeStreet(e.target.value as Street)}>
                        <option value="flop">Flop</option>
                        <option value="turn">Turn</option>
                        <option value="river">River</option>
                      </select>
                    </div>
                    {parentNodeAction === 'raise' && (
                      <div className="edit-modal-field">
                        <label>Raise size (x facing bet)</label>
                        <input type="number" className="edit-modal-input" value={parentNodeSizing} onChange={(e) => setParentNodeSizing(Number(e.target.value) || 3)} min={2} max={100} step={0.5} />
                      </div>
                    )}
                    {parentNodeAction === 'bet' && (
                      <div className="edit-modal-field">
                        <label>Bet size (% of pot)</label>
                        <input type="number" className="edit-modal-input" value={parentNodeSizing} onChange={(e) => setParentNodeSizing(Number(e.target.value) || 50)} min={1} max={500} step={25} />
                      </div>
                    )}
                  </div>
                  <div className="edit-modal-actions">
                    <button className="edit-modal-btn save" onClick={handleAddParentNode}>Add Parent</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
