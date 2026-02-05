import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { BaseTreeNode } from '@/types';

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

// GET /api/profiles?spotId=xxx - List all profiles for a spot
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const spotId = request.nextUrl.searchParams.get('spotId');
    if (!spotId) {
      return NextResponse.json({ error: 'spotId is required' }, { status: 400 });
    }

    // Check if GTO profiles exist, create them if not
    const spot = await prisma.spot.findFirst({
      where: { id: spotId, userId: session.user.id },
    });

    if (spot) {
      const tree = spot.tree as unknown as BaseTreeNode;

      // Check for missing GTO profiles and create them
      for (const player of ['OOP', 'IP'] as const) {
        const existingGto = await prisma.profile.findFirst({
          where: { spotId, userId: session.user.id, player, isGto: true },
        });

        if (!existingGto) {
          await prisma.profile.create({
            data: {
              name: 'GTO',
              description: 'Game Theory Optimal baseline',
              player,
              isGto: true,
              nodeData: createDefaultGtoData(tree, player),
              userId: session.user.id,
              spotId,
            },
          });
        }
      }
    }

    const profiles = await prisma.profile.findMany({
      where: { userId: session.user.id, spotId },
      orderBy: [
        { player: 'asc' },
        { name: 'asc' },
      ],
    });

    const transformed = profiles.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      player: p.player as 'OOP' | 'IP',
      spotId: p.spotId,
      isGto: p.isGto,
      nodeData: p.nodeData as Record<string, { frequency: number; weakPercent?: number }>,
    }));

    return NextResponse.json(transformed);
  } catch (error) {
    console.error('Failed to fetch profiles:', error);
    return NextResponse.json({ error: 'Failed to fetch profiles' }, { status: 500 });
  }
}

// POST /api/profiles - Create a new profile
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, player, nodeData, spotId, isGto } = body;

    if (!name || !player || !spotId) {
      return NextResponse.json({ error: 'Name, player, and spotId are required' }, { status: 400 });
    }

    const profile = await prisma.profile.create({
      data: {
        name,
        description: description || '',
        player,
        isGto: isGto || false,
        nodeData: nodeData || {},
        userId: session.user.id,
        spotId,
      },
    });

    return NextResponse.json({
      id: profile.id,
      name: profile.name,
      description: profile.description,
      player: profile.player as 'OOP' | 'IP',
      spotId: profile.spotId,
      isGto: profile.isGto,
      nodeData: profile.nodeData as Record<string, { frequency: number; weakPercent?: number }>,
    });
  } catch (error) {
    console.error('Failed to create profile:', error);
    return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 });
  }
}
