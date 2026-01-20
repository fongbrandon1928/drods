const MAX_PARTYROLL_NAMES = 30;

const buildRolls = (names) =>
    names.map((name) => ({
        name,
        roll: Math.floor(Math.random() * 100) + 1
    }));

export const handlePartyrollCommand = async (message) => {
    const rawContent = message.content?.trim() || '';
    const unquotedContent = rawContent.replace(/^["']|["']$/g, '');
    if (!unquotedContent.toLowerCase().startsWith('-partyroll')) {
        return false;
    }

    const parts = unquotedContent.split(/\s+/);
    const names = parts.slice(1).filter(Boolean);
    if (names.length === 0) {
        message.reply('Usage: -partyroll <name> <name> ...');
        return true;
    }
    if (names.length > MAX_PARTYROLL_NAMES) {
        message.reply(`Partyroll supports up to ${MAX_PARTYROLL_NAMES} names.`);
        return true;
    }

    const rolls = buildRolls(names).sort((a, b) => b.roll - a.roll);
    const lines = rolls.map((entry, index) => `${index + 1}. ${entry.name}: ${entry.roll}`);
    const shortFormat = rolls
        .map((entry, index) => `${index + 1} - ${entry.name.toLowerCase()}`)
        .join(', ');
    await message.reply(`${lines.join('\n')}\n\nShort string format:\n${shortFormat}`);
    return true;
};
