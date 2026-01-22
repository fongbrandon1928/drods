import { createCanvas, loadImage } from 'canvas';
import { fetchBuffer } from '../services/http.js';

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

export const renderCharacterCard = async (name, avatarUrl, stats) => {
    const width = 800;
    const height = 350;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Background
    try {
        const bg = await loadImage('src/images/bg.png');
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
    try {
        const avatarFetch = fetchBuffer(avatarUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0',
                Accept: 'image/png,image/*;q=0.9,*/*;q=0.8'
            }
        });
        const timeoutMs = 5000;
        const { buffer: avatarBuffer, contentType } = await Promise.race([
            avatarFetch,
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timeout')), timeoutMs)
            )
        ]);
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
    } catch (error) {
        if (error instanceof Error) {
            const match = error.message.match(/^HTTP\s+(\d{3})$/);
            const is5xx = match && match[1].startsWith('10');
            if (is5xx || error.message === 'Timeout') {
                // Skip avatar rendering for timeouts or 5xx errors.
                return canvas.toBuffer('image/png');
            }
        }
        throw error;
    }

    return canvas.toBuffer('image/png');
};
