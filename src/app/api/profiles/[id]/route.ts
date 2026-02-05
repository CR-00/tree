import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

// GET /api/profiles/[id] - Get a single profile
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
    const profile = await prisma.profile.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

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
    console.error('Failed to fetch profile:', error);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}

// PUT /api/profiles/[id] - Update a profile
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
    const { name, description, player, nodeData } = body;

    // Ensure the profile belongs to the user
    const existing = await prisma.profile.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const profile = await prisma.profile.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(player && { player }),
        ...(nodeData && { nodeData }),
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
    console.error('Failed to update profile:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}

// DELETE /api/profiles/[id] - Delete a profile
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

    // Ensure the profile belongs to the user
    const existing = await prisma.profile.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    await prisma.profile.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete profile:', error);
    return NextResponse.json({ error: 'Failed to delete profile' }, { status: 500 });
  }
}
