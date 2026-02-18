import { BaseTreeNode, TreeNode, Profile } from '@/types';

interface ProfileMap {
  OOP: Profile;
  IP: Profile;
}

// Apply GTO and player profiles to a base tree to get display frequencies
export function applyProfilesToTree(
  tree: BaseTreeNode,
  gtoProfiles: ProfileMap,
  playerProfiles: ProfileMap
): TreeNode {
  function processNode(node: BaseTreeNode): TreeNode {
    const gtoProfile = gtoProfiles[node.player];
    const playerProfile = playerProfiles[node.player];

    const gtoData = gtoProfile.nodeData[node.id];
    const playerData = playerProfile.nodeData[node.id];

    // GTO values from GTO profile (default to 1 if not found — show full frequency when unset)
    const gtoFrequency = gtoData?.frequency ?? 1;
    const gtoWeakPercent = gtoData?.weakPercent;

    // Actual values: use player profile if set, otherwise use GTO
    const frequency = playerData?.frequency ?? gtoFrequency;
    const weakPercent = playerData?.weakPercent ?? gtoWeakPercent;

    return {
      ...node,
      frequency,
      gtoFrequency,
      weakPercent,
      gtoWeakPercent,
      children: node.children.map(processNode),
    };
  }

  return processNode(tree);
}
