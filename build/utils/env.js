"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDiscordToken = getDiscordToken;
exports.getDiscordTokenValidationError = getDiscordTokenValidationError;
function getDiscordToken() {
    const rawToken = process.env.DISCORD_TOKEN;
    if (!rawToken)
        return null;
    let token = rawToken.trim();
    if (token.startsWith('DISCORD_TOKEN=')) {
        token = token.slice('DISCORD_TOKEN='.length).trim();
    }
    token = token.replace(/^Bot\s+/i, '').trim();
    const quote = token[0];
    if ((quote === '"' || quote === "'") && token[token.length - 1] === quote) {
        token = token.slice(1, -1).trim();
    }
    return token || null;
}
function getDiscordTokenValidationError(token) {
    if (/\s/.test(token)) {
        return 'DISCORD_TOKEN contem espacos ou quebra de linha. Cole somente o token puro do bot no Render.';
    }
    return null;
}
//# sourceMappingURL=env.js.map