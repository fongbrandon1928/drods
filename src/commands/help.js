const HELP_MESSAGE = [
    'Available commands:',
    '-help',
    '-maple <player>'
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
