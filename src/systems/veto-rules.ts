import { VetoVez } from '../types/index';

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
