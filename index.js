import dotenv from 'dotenv'
dotenv.config()

import { Client, Intents } from 'discord.js';
import https from 'node:https';
import http from 'node:http';
import { createCanvas, loadImage } from 'canvas';

const fetchText = (url) =>
    new Promise((resolve, reject) => {
        https
            .get(url, (res) => {
                if (res.statusCode && res.statusCode >= 400) {
                    reject(new Error(`HTTP ${res.statusCode}`));
                    return;
                }
                res.setEncoding('utf8');
                let data = '';
                res.on('data', (chunk) => (data += chunk));
                res.on('end', () => resolve(data));
            })
            .on('error', reject);
    });

const fetchBuffer = (url, options = {}, redirects = 0) =>
    new Promise((resolve, reject) => {
        https
            .get(url, options, (res) => {
                const status = res.statusCode || 0;
                const location = res.headers.location;
                if (status >= 300 && status < 400 && location) {
                    if (redirects >= 3) {
                        reject(new Error('Too many redirects'));
                        return;
                    }
                    fetchBuffer(location, options, redirects + 1).then(resolve).catch(reject);
                    res.resume();
                    return;
                }
                if (status >= 400) {
                    reject(new Error(`HTTP ${status}`));
                    return;
                }
                const contentType = res.headers['content-type'];
                const chunks = [];
                res.on('data', (chunk) => chunks.push(chunk));
                res.on('end', () => resolve({ buffer: Buffer.concat(chunks), contentType }));
            })
            .on('error', reject);
    });

const extractPngBuffer = (buffer, contentType) => {
    if (contentType && !contentType.includes('image/png')) {
        throw new Error(`Unexpected content-type: ${contentType}`);
    }
    const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const signatureIndex = buffer.indexOf(signature);
    if (signatureIndex === -1) {
        throw new Error('PNG signature not found');
    }

    const iend = Buffer.from([0x49, 0x45, 0x4e, 0x44]);
    const iendIndex = buffer.indexOf(iend, signatureIndex);
    if (iendIndex === -1) {
        throw new Error('PNG IEND not found');
    }

    const pngEnd = iendIndex + 4 + 4; // IEND + CRC
    return buffer.slice(signatureIndex, pngEnd);
};

const renderCharacterCard = async (name, avatarUrl, stats) => {
    const width = 800;
    const height = 350;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Background
    try {
        const bg = await loadImage('bg.png');
        ctx.drawImage(bg, 0, 0, width, height);
    } catch {
        ctx.fillStyle = '#1f1f1f';
        ctx.fillRect(0, 0, width, height);

        // Slight gradient overlay
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, '#2a2a2a');
        gradient.addColorStop(1, '#151515');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
    }

    // Text box
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(24, 24, 380, height - 48);

    // Text
    ctx.fillStyle = '#ffffff';
    ctx.font = '22px Arial';
    ctx.fillText(stats.title, 40, 60);

    ctx.font = '20px Arial';
    let y = 95;
    for (const line of stats.lines) {
        ctx.fillText(line, 40, y);
        y += 28;
    }

    // Avatar on the right (anchored to a fixed point)
    const { buffer: avatarBuffer, contentType } = await fetchBuffer(
        avatarUrl,
        {
            headers: {
                'User-Agent': 'Mozilla/5.0',
                Accept: 'image/png,image/*;q=0.9,*/*;q=0.8'
            }
        }
    );
    const pngBuffer = extractPngBuffer(avatarBuffer, contentType);
    const avatarImage = await loadImage(pngBuffer);
    const maxAvatarHeight = height - 80;
    const scale = 2
    const drawWidth = avatarImage.width * scale;
    const drawHeight = avatarImage.height * scale;
    const anchorX = width - 150;
    const groundY = height - 30;
    const x = anchorX - drawWidth / 2;
    const yAvatar = groundY - drawHeight;
    ctx.drawImage(avatarImage, x, yAvatar, drawWidth, drawHeight);

    return canvas.toBuffer('image/png');
};

const client = new Client({
    intents: [
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_MESSAGES,
        Intents.FLAGS.DIRECT_MESSAGES,
        Intents.FLAGS.MESSAGE_CONTENT
    ]
});

client.on('messageCreate', async (message) => {
    if (message.author?.bot) return;
    if (message.content?.trim() === '-test') {
        message.reply('Test received!');
    }

    const rawContent = message.content?.trim() || '';
    const unquotedContent = rawContent.replace(/^["']|["']$/g, '');
    if (unquotedContent.toLowerCase().startsWith('-maple')) {
        const rawName = unquotedContent.slice(6).trim();
        const name = rawName.replace(/^["']|["']$/g, '');
        if (!name) {
            message.reply('Usage: -maple <player>');
            return;
        }

        const jsonUrl = `https://maplelegends.com/api/character?name=${encodeURIComponent(name)}`;
        const avatarUrl = `https://maplelegends.com/api/getavatar?name=${encodeURIComponent(name)}&t=${Date.now()}`;
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
            const expValue =
                levelValue === 200 ? 'MAX' : parsed?.exp ? String(parsed.exp) : null;
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
        } catch (error) {
            console.error('Maple command failed:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            message.reply(`Maple API request failed: ${errorMessage}`);
        }
    }
});

const port = Number(process.env.PORT) || 10000;
const server = http.createServer((req, res) => {
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('ok');
        return;
    }
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('bot running');
});

server.listen(port, '0.0.0.0', () => {
    console.log(`Web server listening on ${port}`);
});

client.login(process.env.DISCORD_TOKEN);

