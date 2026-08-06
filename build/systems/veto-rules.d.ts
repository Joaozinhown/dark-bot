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
export declare function drawStartingTeam(random?: () => number): VetoVez;
export declare function getKillerTeamForSet(starter: VetoVez, setNumber: number): VetoVez;
export declare function getVetoAction(format: PoolFormato, stepIndex: number): VetoActionState;
export declare function getPickSetNumber(action: VetoAction, pickedKillerCount: number): number | null;
export declare function createSetAssignments(maps: string[], killers: string[], starter: VetoVez): SetAssignment[];
//# sourceMappingURL=veto-rules.d.ts.map