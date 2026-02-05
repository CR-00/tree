import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { TreeNode } from '@/types';

// GET /api/spots/[id] - Get a single spot
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const spot = await prisma.spot.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!spot) {
      return NextResponse.json({ error: 'Spot not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: spot.id,
      name: spot.name,
      description: spot.description,
      tree: spot.tree as unknown as TreeNode,
    });
  } catch (error) {
    console.error('Failed to fetch spot:', error);
    return NextResponse.json({ error: 'Failed to fetch spot' }, { status: 500 });
  }
}

// PUT /api/spots/[id] - Update a spot
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, description, tree } = body;

    // Ensure the spot belongs to the user
    const existing = await prisma.spot.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Spot not found' }, { status: 404 });
    }

    const spot = await prisma.spot.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(tree && { tree }),
      },
    });

    return NextResponse.json({
      id: spot.id,
      name: spot.name,
      description: spot.description,
      tree: spot.tree as unknown as TreeNode,
    });
  } catch (error) {
    console.error('Failed to update spot:', error);
    return NextResponse.json({ error: 'Failed to update spot' }, { status: 500 });
  }
}

// DELETE /api/spots/[id] - Delete a spot
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Ensure the spot belongs to the user
    const existing = await prisma.spot.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Spot not found' }, { status: 404 });
    }

    await prisma.spot.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete spot:', error);
    return NextResponse.json({ error: 'Failed to delete spot' }, { status: 500 });
  }
}
