import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { BaseTreeNode, TreeNode } from '@/types';

// Extract all node IDs from a tree for a specific player
function getPlayerNodeIds(node: BaseTreeNode, player: 'OOP' | 'IP'): string[] {
  const ids: string[] = [];
  if (node.player === player) {
    ids.push(node.id);
  }
  for (const child of node.children) {
    ids.push(...getPlayerNodeIds(child, player));
  }
  return ids;
}

// Create default GTO node data (all frequencies at 0)
function createDefaultGtoData(tree: BaseTreeNode, player: 'OOP' | 'IP'): Record<string, { frequency: number }> {
  const nodeIds = getPlayerNodeIds(tree, player);
  const data: Record<string, { frequency: number }> = {};
  for (const id of nodeIds) {
    data[id] = { frequency: 0 };
  }
  return data;
}

// GET /api/spots - List all spots for the current user
export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const spots = await prisma.spot.findMany({
      where: { userId: session.user.id },
      orderBy: { name: 'asc' },
    });

    const transformed = spots.map(s => ({
      id: s.id,
      name: s.name,
      description: s.description,
      tree: s.tree as unknown as TreeNode,
    }));

    return NextResponse.json(transformed);
  } catch (error) {
    console.error('Failed to fetch spots:', error);
    return NextResponse.json({ error: 'Failed to fetch spots' }, { status: 500 });
  }
}

// POST /api/spots - Create a new spot
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, tree } = body;

    if (!name || !tree) {
      return NextResponse.json({ error: 'Name and tree are required' }, { status: 400 });
    }

    // Create spot with default GTO profiles for both players
    const spot = await prisma.spot.create({
      data: {
        name,
        description: description || '',
        tree,
        userId: session.user.id,
        profiles: {
          create: [
            {
              name: 'GTO',
              description: 'Game Theory Optimal baseline',
              player: 'OOP',
              isGto: true,
              nodeData: createDefaultGtoData(tree as BaseTreeNode, 'OOP'),
              userId: session.user.id,
            },
            {
              name: 'GTO',
              description: 'Game Theory Optimal baseline',
              player: 'IP',
              isGto: true,
              nodeData: createDefaultGtoData(tree as BaseTreeNode, 'IP'),
              userId: session.user.id,
            },
          ],
        },
      },
    });

    return NextResponse.json({
      id: spot.id,
      name: spot.name,
      description: spot.description,
      tree: spot.tree as unknown as TreeNode,
    });
  } catch (error) {
    console.error('Failed to create spot:', error);
    return NextResponse.json({ error: 'Failed to create spot' }, { status: 500 });
  }
}
