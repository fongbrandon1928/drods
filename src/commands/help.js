const HELP_MESSAGE = [
    'Available commands:',
    '-help',
    '-maple <player>',
    '-bloodwash <level> <str> <dex> <int> <luk>',
    '-partyroll <name> <name> ...',
    '-roll <number>',
    '-washes <class> <level> <base mp> (beginner, spearman, fighter, page, thief, bowman, magician, gunslinger, brawler)',
    '-sb <soundname>',
    '-sbpanel'
].join('\n');

export const handleHelpCommand = async (message) => {
    const rawContent = message.content?.trim() || '';
    const unquotedContent = rawContent.replace(/^["']|["']$/g, '');
    if (unquotedContent.toLowerCase() !== '-help') {
        return false;
    }

    await message.reply(HELP_MESSAGE);
    return true;
};
