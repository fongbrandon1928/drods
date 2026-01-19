import https from 'node:https';

export const fetchText = (url) =>
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

export const fetchBuffer = (url, options = {}, redirects = 0) =>
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
