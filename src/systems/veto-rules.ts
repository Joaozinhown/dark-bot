import { PoolFormato, VetoVez } from '../types/index';

export type VetoAction = 'pick' | 'ban';

export interface VetoActionState {
  action: VetoAction;
  isTiebreak: boolean;
}

export interface SetAssignment {
  numero: number;
  mapa: string;
  killer: string;
  killerTime: VetoVez;
}

export function drawStartingTeam(random: () => number = Math.random): VetoVez {
  return random() < 0.5 ? 'A' : 'B';
}

export function getKillerTeamForSet(starter: VetoVez, setNumber: number): VetoVez {
  const isStarterSet = setNumber % 2 === 1;
  if (isStarterSet) return starter;
  return starter === 'A' ? 'B' : 'A';
}

export function getVetoAction(format: PoolFormato, stepIndex: number): VetoActionState {
  const pickSteps = format === 'MD3' ? [4, 5] : [2, 3, 6, 7];
  const tiebreakStartsAt = format === 'MD3' ? 6 : 8;
  return {
    action: pickSteps.includes(stepIndex) ? 'pick' : 'ban',
    isTiebreak: stepIndex >= tiebreakStartsAt,
  };
}

export function getPickSetNumber(action: VetoAction, pickedKillerCount: number): number | null {
  return action === 'pick' ? pickedKillerCount + 1 : null;
}

export function createSetAssignments(
  maps: string[],
  killers: string[],
  starter: VetoVez,
): SetAssignment[] {
  if (maps.length !== killers.length) {
    throw new Error('O veto deve terminar com um killer por mapa.');
  }

  return maps.map((mapa, index) => ({
    numero: index + 1,
    mapa,
    killer: killers[index],
    killerTime: getKillerTeamForSet(starter, index + 1),
  }));
}
