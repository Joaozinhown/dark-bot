"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.drawStartingTeam = drawStartingTeam;
exports.getKillerTeamForSet = getKillerTeamForSet;
exports.getVetoAction = getVetoAction;
exports.getPickSetNumber = getPickSetNumber;
exports.createSetAssignments = createSetAssignments;
function drawStartingTeam(random = Math.random) {
    return random() < 0.5 ? 'A' : 'B';
}
function getKillerTeamForSet(starter, setNumber) {
    const isStarterSet = setNumber % 2 === 1;
    if (isStarterSet)
        return starter;
    return starter === 'A' ? 'B' : 'A';
}
function getVetoAction(format, stepIndex) {
    const pickSteps = format === 'MD3' ? [4, 5] : [2, 3, 6, 7];
    const tiebreakStartsAt = format === 'MD3' ? 6 : 8;
    return {
        action: pickSteps.includes(stepIndex) ? 'pick' : 'ban',
        isTiebreak: stepIndex >= tiebreakStartsAt,
    };
}
function getPickSetNumber(action, pickedKillerCount) {
    return action === 'pick' ? pickedKillerCount + 1 : null;
}
function createSetAssignments(maps, killers, starter) {
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
//# sourceMappingURL=veto-rules.js.map