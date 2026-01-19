const getTotalAbilityPoints = (level) => {
    if (!Number.isInteger(level) || level < 1) return null;
    const cappedLevel = Math.min(level, 200);
    let total = 25 + (cappedLevel - 1) * 5;
    if (cappedLevel >= 120) {
        total += 10;
    } else if (cappedLevel >= 70) {
        total += 5;
    }
    return total;
};

export const handleBloodwashCommand = async (message) => {
    const rawContent = message.content?.trim() || '';
    const unquotedContent = rawContent.replace(/^["']|["']$/g, '');
    if (!unquotedContent.toLowerCase().startsWith('-bloodwash')) {
        return false;
    }

    const parts = unquotedContent.split(/\s+/);
    if (parts.length !== 6) {
        message.reply('Usage: -bloodwash <level> <str> <dex> <int> <luk>');
        return true;
    }

    const [levelRaw, strRaw, dexRaw, intRaw, lukRaw] = parts.slice(1);
    const level = Number(levelRaw);
    const str = Number(strRaw);
    const dex = Number(dexRaw);
    const intStat = Number(intRaw);
    const luk = Number(lukRaw);

    if (![level, str, dex, intStat, luk].every((value) => Number.isFinite(value))) {
        message.reply('Usage: -bloodwash <level> <str> <dex> <int> <luk>');
        return true;
    }

    const totalPoints = getTotalAbilityPoints(level);
    if (totalPoints === null) {
        message.reply('Level must be 1 or higher.');
        return true;
    }

    const assigned = str + dex + intStat + luk;
    const remaining = totalPoints - assigned;
    message.reply(`Nonassigned AP: ${remaining}`);
    return true;
};
