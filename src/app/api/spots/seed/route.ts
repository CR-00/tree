import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession, ensureDevUser } from '@/lib/auth';
import { BaseTreeNode } from '@/types';

// Base tree structure - no frequencies
const defaultTree: BaseTreeNode = {
  id: 'root',
  action: 'check',
  player: 'OOP',
  street: 'flop',
  children: [
    {
      id: 'bb-x-btn-b',
      action: 'bet',
      player: 'IP',
      street: 'flop',
      sizing: 33,
      children: [
        {
          id: 'bb-x-btn-b-bb-c',
          action: 'call',
          player: 'OOP',
          street: 'flop',
          children: [
            {
              id: 'bb-x-btn-b-bb-c-btn-b',
              action: 'bet',
              player: 'IP',
              street: 'turn',
              sizing: 66,
              children: [
                {
                  id: 'bb-x-btn-b-bb-c-btn-b-bb-f',
                  action: 'fold',
                  player: 'OOP',
                  street: 'turn',
                  children: [],
                },
              ],
            },
            {
              id: 'bb-x-btn-b-bb-c-btn-x',
              action: 'check',
              player: 'IP',
              street: 'turn',
              children: [
                {
                  id: 'bb-x-btn-b-bb-c-btn-x-bb-b',
                  action: 'bet',
                  player: 'OOP',
                  street: 'turn',
                  sizing: 75,
                  children: [
                    {
                      id: 'bb-x-btn-b-bb-c-btn-x-bb-b-btn-r',
                      action: 'raise',
                      player: 'IP',
                      street: 'turn',
                      sizing: 3,
                      children: [],
                    },
                    {
                      id: 'bb-x-btn-b-bb-c-btn-x-bb-b-btn-c',
                      action: 'call',
                      player: 'IP',
                      street: 'turn',
                      children: [],
                    },
                    {
                      id: 'bb-x-btn-b-bb-c-btn-x-bb-b-btn-f',
                      action: 'fold',
                      player: 'IP',
                      street: 'turn',
                      children: [],
                    },
                  ],
                },
                {
                  id: 'bb-x-btn-b-bb-c-btn-x-bb-x',
                  action: 'check',
                  player: 'OOP',
                  street: 'turn',
                  children: [
                    {
                      id: 'bb-x-btn-b-bb-c-btn-x-bb-x-btn-x',
                      action: 'check',
                      player: 'IP',
                      street: 'river',
                      children: [],
                    },
                    {
                      id: 'bb-x-btn-b-bb-c-btn-x-bb-x-btn-b',
                      action: 'bet',
                      player: 'IP',
                      street: 'river',
                      sizing: 75,
                      children: [
                        {
                          id: 'bb-x-btn-b-bb-c-btn-x-bb-x-btn-b-bb-f',
                          action: 'fold',
                          player: 'OOP',
                          street: 'river',
                          children: [],
                        },
                        {
                          id: 'bb-x-btn-b-bb-c-btn-x-bb-x-btn-b-bb-c',
                          action: 'call',
                          player: 'OOP',
                          street: 'river',
                          children: [],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          id: 'bb-x-btn-b-bb-r',
          action: 'raise',
          player: 'OOP',
          street: 'flop',
          sizing: 3,
          children: [],
        },
        {
          id: 'bb-x-btn-b-bb-f',
          action: 'fold',
          player: 'OOP',
          street: 'flop',
          children: [],
        },
      ],
    },
    {
      id: 'bb-x-btn-x',
      action: 'check',
      player: 'IP',
      street: 'flop',
      children: [
        {
          id: 'bb-x-btn-x-bb-b',
          action: 'bet',
          player: 'OOP',
          street: 'turn',
          sizing: 50,
          children: [
            {
              id: 'bb-x-btn-x-bb-b-btn-f',
              action: 'fold',
              player: 'IP',
              street: 'turn',
              children: [],
            },
            {
              id: 'bb-x-btn-x-bb-b-btn-c',
              action: 'call',
              player: 'IP',
              street: 'turn',
              children: [],
            },
          ],
        },
        {
          id: 'bb-x-btn-x-bb-x',
          action: 'check',
          player: 'OOP',
          street: 'turn',
          children: [
            {
              id: 'bb-x-btn-x-bb-x-btn-b',
              action: 'bet',
              player: 'IP',
              street: 'turn',
              sizing: 66,
              children: [
                {
                  id: 'bb-x-btn-x-bb-x-btn-b-bb-f',
                  action: 'fold',
                  player: 'OOP',
                  street: 'turn',
                  children: [],
                },
                {
                  id: 'bb-x-btn-x-bb-x-btn-b-bb-c',
                  action: 'call',
                  player: 'OOP',
                  street: 'turn',
                  children: [],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

// GTO profile for OOP - contains baseline frequencies for all OOP nodes
const gtoOOPData = {
  'root': { frequency: 1 },
  'bb-x-btn-b-bb-c': { frequency: 0.68 },
  'bb-x-btn-b-bb-c-btn-b-bb-f': { frequency: 0.35 },
  'bb-x-btn-b-bb-c-btn-x-bb-b': { frequency: 0.42 },
  'bb-x-btn-b-bb-c-btn-x-bb-x': { frequency: 0.58 },
  'bb-x-btn-b-bb-c-btn-x-bb-x-btn-b-bb-f': { frequency: 0.28 },
  'bb-x-btn-b-bb-c-btn-x-bb-x-btn-b-bb-c': { frequency: 0.72 },
  'bb-x-btn-b-bb-r': { frequency: 0.22 },
  'bb-x-btn-b-bb-f': { frequency: 0.10 },
  'bb-x-btn-x-bb-b': { frequency: 0.48 },
  'bb-x-btn-x-bb-x': { frequency: 0.52 },
  'bb-x-btn-x-bb-x-btn-b-bb-f': { frequency: 0.18 },
  'bb-x-btn-x-bb-x-btn-b-bb-c': { frequency: 0.82 },
};

// GTO profile for IP - contains baseline frequencies for all IP nodes
const gtoIPData = {
  'bb-x-btn-b': { frequency: 0.63, weakPercent: 0.30 },
  'bb-x-btn-b-bb-c-btn-b': { frequency: 0.52, weakPercent: 0.25 },
  'bb-x-btn-b-bb-c-btn-x': { frequency: 0.48 },
  'bb-x-btn-b-bb-c-btn-x-bb-b-btn-r': { frequency: 0.08, weakPercent: 0.40 },
  'bb-x-btn-b-bb-c-btn-x-bb-b-btn-c': { frequency: 0.71 },
  'bb-x-btn-b-bb-c-btn-x-bb-b-btn-f': { frequency: 0.21 },
  'bb-x-btn-b-bb-c-btn-x-bb-x-btn-x': { frequency: 0.35 },
  'bb-x-btn-b-bb-c-btn-x-bb-x-btn-b': { frequency: 0.65 },
  'bb-x-btn-x': { frequency: 0.37 },
  'bb-x-btn-x-bb-b-btn-f': { frequency: 0.15 },
  'bb-x-btn-x-bb-b-btn-c': { frequency: 0.85 },
  'bb-x-btn-x-bb-x-btn-b': { frequency: 0.55 },
};

// Fish profile for OOP - folds too much
const fishOOPData = {
  'bb-x-btn-b-bb-c': { frequency: 0.55 },
  'bb-x-btn-b-bb-c-btn-b-bb-f': { frequency: 0.50 },
  'bb-x-btn-b-bb-c-btn-x-bb-x-btn-b-bb-f': { frequency: 0.45 },
  'bb-x-btn-x-bb-x-btn-b-bb-f': { frequency: 0.35 },
};

// Fish profile for IP - bluffs too much
const fishIPData = {
  'bb-x-btn-b': { frequency: 0.75, weakPercent: 0.50 },
  'bb-x-btn-b-bb-c-btn-b': { frequency: 0.65, weakPercent: 0.45 },
};

const defaultSpot = {
  name: 'SRP',
  description: 'Single Raised Pot',
  oopCombos: 282,
  ipCombos: 332,
  tree: defaultTree,
};

// POST /api/spots/seed - Seed default spot and profiles for the current user
export async function POST() {
  try {
    await ensureDevUser();

    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const existingCount = await prisma.spot.count({
      where: { userId: session.user.id },
    });

    if (existingCount > 0) {
      return NextResponse.json({ message: 'Already seeded', count: existingCount });
    }

    // Create spot with GTO profiles and Fish profiles
    const spot = await prisma.spot.create({
      data: {
        name: defaultSpot.name,
        description: defaultSpot.description,
        oopCombos: defaultSpot.oopCombos,
        ipCombos: defaultSpot.ipCombos,
        tree: JSON.parse(JSON.stringify(defaultSpot.tree)),
        userId: session.user.id,
        profiles: {
          create: [
            // GTO profiles (one per player)
            {
              name: 'GTO',
              description: 'Game Theory Optimal baseline',
              player: 'OOP',
              isGto: true,
              nodeData: gtoOOPData,
              userId: session.user.id,
            },
            {
              name: 'GTO',
              description: 'Game Theory Optimal baseline',
              player: 'IP',
              isGto: true,
              nodeData: gtoIPData,
              userId: session.user.id,
            },
            // Custom profiles
            {
              name: 'Fish',
              description: 'Recreational player - folds too much',
              player: 'OOP',
              isGto: false,
              nodeData: fishOOPData,
              userId: session.user.id,
            },
            {
              name: 'Fish',
              description: 'Recreational player - bluffs too much',
              player: 'IP',
              isGto: false,
              nodeData: fishIPData,
              userId: session.user.id,
            },
          ],
        },
      },
    });

    return NextResponse.json({ message: 'Seeded successfully', spotId: spot.id });
  } catch (error) {
    console.error('Failed to seed:', error);
    return NextResponse.json({ error: 'Failed to seed' }, { status: 500 });
  }
}
