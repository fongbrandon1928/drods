import { fetchText } from '../services/http.js';
import { renderCharacterCard } from '../render/renderCharacterCard.js';

export const handleMapleCommand = async (message) => {
    const rawContent = message.content?.trim() || '';
    const unquotedContent = rawContent.replace(/^["']|["']$/g, '');
    if (!unquotedContent.toLowerCase().startsWith('-maple')) {
        return false;
    }

    const rawName = unquotedContent.slice(6).trim();
    const name = rawName.replace(/^["']|["']$/g, '');
    if (!name) {
        message.reply('Usage: -maple <player>');
        return true;
    }

    const jsonUrl = `https://legends.ml/api/character?name=${encodeURIComponent(name)}`;
    const avatarUrl = `https://legends.ml/api/getavatar?name=${encodeURIComponent(name)}&t=${Date.now()}`;
    try {
        const jsonData = await fetchText(jsonUrl);
        let parsed = null;
        try {
            parsed = JSON.parse(jsonData);
            if (parsed && typeof parsed === 'object') {
                delete parsed.donor;
            }
        } catch {}

        const levelValue = parsed?.level;
        const expValue = levelValue === 200 ? 'MAX' : parsed?.exp ? String(parsed.exp) : null;
        const stats = {
            title: parsed?.name ? String(parsed.name) : name,
            lines: [
                levelValue !== undefined ? `Level: ${levelValue}` : null,
                expValue ? `Exp: ${expValue}` : null,
                parsed?.fame !== undefined ? `Fame: ${parsed.fame}` : null,
                parsed?.cards !== undefined ? `Cards: ${parsed.cards}` : null,
                parsed?.quests !== undefined ? `Quests: ${parsed.quests}` : null,
                parsed?.job ? `Job: ${parsed.job}` : null,
                parsed?.guild ? `Guild: ${parsed.guild}` : null
            ].filter(Boolean)
        };

        const cardBuffer = await renderCharacterCard(name, avatarUrl, stats);
        const safeName = name.replace(/[^a-z0-9-_]/gi, '_');
        await message.reply({
            files: [{ attachment: cardBuffer, name: `${safeName || 'player'}.png` }]
        });
        return true;
    } catch (error) {
        console.error('Maple command failed:', error);
        if (error instanceof Error && error.message.includes('HTTP 404')) {
            message.reply('Character not found');
            return true;
        }
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        message.reply(`Maple API request failed: ${errorMessage}`);
        return true;
    }
};
