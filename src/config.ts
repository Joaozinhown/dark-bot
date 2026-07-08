import { PoolConfig, PoolFormato } from './types/index';
import prisma from './database/client';

export type { PoolFormato } from './types/index';

export const COLORS = {
  primary: '#0a0a14',
  secondary: '#1a1a2e',
  accent: '#dc143c',
  gold: '#c9a227',
  success: '#2ecc71',
  warning: '#f39c12',
  error: '#e74c3c',
  neutral: '#95a5a6',
  text: '#ffffff',
  textMuted: '#b9bbbe',
} as const;

export const EMOJIS = {
  ban: 'X',
  check: 'OK',
  vs: 'VS',
} as const;

export async function getPoolById(id: number, guildId: string): Promise<PoolConfig | null> {
  const pool = await prisma.pool.findFirst({
    where: {
      id,
      guildId,
      ativa: true,
    },
    include: {
      mapas: { orderBy: { ordem: 'asc' } },
      killers: { orderBy: { ordem: 'asc' } },
    },
  });

  if (!pool) return null;

  return {
    id: pool.id,
    formato: pool.formato as PoolFormato,
    mapas: pool.mapas.map(m => m.nome),
    killers: pool.killers.map(k => k.nome),
  };
}

export async function getPoolsAtivas(guildId: string): Promise<PoolConfig[]> {
  const pools = await prisma.pool.findMany({
    where: {
      guildId,
      ativa: true,
    },
    include: {
      mapas: { orderBy: { ordem: 'asc' } },
      killers: { orderBy: { ordem: 'asc' } },
    },
    orderBy: { id: 'asc' },
  });

  return pools.map(pool => ({
    id: pool.id,
    formato: pool.formato as PoolFormato,
    mapas: pool.mapas.map(m => m.nome),
    killers: pool.killers.map(k => k.nome),
  }));
}

export function getVitoriasNecessarias(formato: PoolFormato): number {
  return formato === 'MD3' ? 2 : 3;
}

export function getSetsMaximos(formato: PoolFormato): number {
  return formato === 'MD3' ? 3 : 5;
}
