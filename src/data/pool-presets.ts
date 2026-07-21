import { PoolFormato } from '../types/index';

export interface PoolPreset {
  nome: string;
  formato: PoolFormato;
  mapas: string[];
  killers: string[];
}

export const POOL_PRESETS: PoolPreset[] = [
  {
    nome: 'Queens Trials 1',
    formato: 'MD3',
    mapas: [
      "Azarov's Resting Place",
      'Shelter Woods',
      'Ormond Lake Mine',
    ],
    killers: [
      'Artist',
      'Ghoul',
      'Krasue',
      'Lich',
      'Nurse',
      'Oni',
      'Plague',
      'Singularity',
      'Spirit',
    ],
  },
  {
    nome: 'Queens Trials 2',
    formato: 'MD5',
    mapas: [
      'Dead Dawg Saloon',
      'Coal Tower',
      'Treatment Theater',
      'Blood Lodge',
      'Toba Landing',
    ],
    killers: [
      'Cenobite',
      'Clown',
      'Dark Lord',
      'Doctor',
      'Ghost Face',
      'Good Guy',
      'Krasue',
      'Lich',
      'Shape',
      'Slasher',
      'Wraith',
    ],
  },
];
