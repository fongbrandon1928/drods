import path from 'node:path';

export const handleCWKPQCommand = async (message) => {
    const rawContent = message.content?.trim() || '';
    const unquotedContent = rawContent.replace(/^["']|["']$/g, '');
    if (!unquotedContent.toLowerCase().startsWith('-cwkpq')) {
        return false;
    }

    const parts = unquotedContent.split(/\s+/);

    if (parts.length < 2) {
        message.reply(
            'Usage: -cwkpq <3-6 players>'
        );
        return true;
    }

    const playerCount = parts[1];

    switch(playerCount) {
        case '3':
            message.reply({
                files: [path.join('src', 'images', 'cwkpq', 'cwkpq3.png')]
            });
            return true;
        case '4':
            message.reply({
                files: [path.join('src', 'images', 'cwkpq', 'cwkpq4.png')]
            });
            return true;
        case '5':
            message.reply({
                files: [path.join('src', 'images', 'cwkpq', 'cwkpq5.png')]
            });
            return true;
        case '6':
            message.reply({
                files: [path.join('src', 'images', 'cwkpq', 'cwkpq6.png')]
            });
            return true;
        default:
            message.reply('Invalid number of players');
            return true;
    }
    return true;
}