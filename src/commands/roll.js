export const handleRollCommand = async (message) => {
    const rawContent = message.content?.trim() || '';
    const unquotedContent = rawContent.replace(/^["']|["']$/g, '');
    if (!unquotedContent.toLowerCase().startsWith('-roll')) {
        return false;
    }

    const parts = unquotedContent.split(/\s+/);
    const maxValue = Number(parts[1]);
    const isInteger = Number.isInteger(maxValue);
    if (!isInteger || maxValue < 1) {
        await message.reply('Usage: -roll <number greater than 0>');
        return true;
    }

    const rolled = Math.floor(Math.random() * maxValue) + 1;
    await message.reply(`You rolled ${rolled} (1-${maxValue}).`);
    return true;
};
