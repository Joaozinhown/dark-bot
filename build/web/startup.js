"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readPanelConfigSafely = readPanelConfigSafely;
exports.runPanelBeforeBot = runPanelBeforeBot;
function readPanelConfigSafely(options) {
    try {
        return options.readConfig();
    }
    catch (error) {
        options.reportConfigError(error);
        return { enabled: false };
    }
}
async function runPanelBeforeBot(options) {
    if (options.config.enabled) {
        try {
            await options.startPanel(options.config);
        }
        catch (error) {
            options.reportPanelError(error);
        }
    }
    await options.startBot();
}
//# sourceMappingURL=startup.js.map