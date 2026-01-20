const CLASS_RULES = {
    beginner: {
        divisor: 8,
        avgHp: 10,
        minMp: (level) => 10 * level - 5
    },
    spearman: {
        divisor: 4,
        avgHp: 52,
        minMp: (level) => 4 * level + 155
    },
    fighter: {
        divisor: 4,
        avgHp: 52,
        minMp: (level) => 4 * level + 55
    },
    page: {
        divisor: 4,
        avgHp: 52,
        minMp: (level) => 4 * level + 55
    },
    thief: {
        divisor: 12,
        avgHp: 18,
        minMp: (level) => 14 * level + 135
    },
    bowman: {
        divisor: 12,
        avgHp: 18,
        minMp: (level) => 14 * level + 135
    },
    magician: {
        divisor: 30,
        avgHp: 8,
        minMp: (level) => 22 * level + 449
    },
    gunslinger: {
        divisor: 16,
        avgHp: 18,
        minMp: (level) => 18 * level + 95
    },
    brawler: {
        divisor: 16,
        avgHp: 38,
        minMp: (level) => 18 * level + 95
    }
};

export const handleWashesCommand = async (message) => {
    const rawContent = message.content?.trim() || '';
    const unquotedContent = rawContent.replace(/^["']|["']$/g, '');
    if (!unquotedContent.toLowerCase().startsWith('-washes')) {
        return false;
    }

    const parts = unquotedContent.split(/\s+/);
    if (parts.length < 4) {
        message.reply(
            'Usage: -washes <class> <level> <base mp>\nValid classes: beginner, spearman, fighter, page, thief, bowman, magician, gunslinger, brawler.'
        );
        return true;
    }

    const className = parts[1].toLowerCase();
    const level = Number(parts[2]);
    const baseMp = Number(parts.slice(3).join(''));
    const rule = CLASS_RULES[className];

    if (!rule) {
        message.reply(
            'Invalid class. Use: beginner, spearman, fighter, page, thief, bowman, magician, gunslinger, brawler.'
        );
        return true;
    }

    if (!Number.isFinite(level) || !Number.isFinite(baseMp)) {
        message.reply('Usage: -washes <class> <level> <base mp>');
        return true;
    }

    if (level < 30) {
        message.reply('Level must be 30 or above.');
        return true;
    }

    const minMp = rule.minMp(Math.floor(level));
    const excessMp = Math.max(0, Math.floor(baseMp - minMp));
    const washes = Math.floor(excessMp / rule.divisor);
    const estimatedHp = washes * rule.avgHp;

    message.reply(
        `Excess MP: ${excessMp}\nWashes: ${washes}\nEstimated HP gain: ${estimatedHp}`
    );
    return true;
};
