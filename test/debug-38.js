// 38커뮤니케이션 HTML 구조 디버깅
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');
const crypto = require('crypto');
const iconv = require('iconv-lite');

const agent = new https.Agent({
    secureOptions: crypto.constants?.SSL_OP_LEGACY_SERVER_CONNECT || 0,
    ciphers: 'DEFAULT:@SECLEVEL=0',
});

(async () => {
    const url = 'https://www.38.co.kr/html/fund/index.htm?o=k';
    const resp = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        responseType: 'arraybuffer',
        httpsAgent: agent,
        timeout: 15000,
    });

    const html = iconv.decode(Buffer.from(resp.data), 'euc-kr');
    const $ = cheerio.load(html);

    // Find tables with many rows (likely the IPO table)
    $('table').each((idx, table) => {
        const rows = $(table).find('tr');
        if (rows.length > 5) {
            console.log(`table[${idx}]: ${rows.length} rows`);
            // Print first 3 rows
            rows.each((ri, row) => {
                if (ri > 3) return false;
                const cells = [];
                $(row).find('td, th').each((_, cell) => {
                    cells.push($(cell).text().trim().substring(0, 20));
                });
                console.log(`  row[${ri}]: [${cells.join(' | ')}]`);
            });
            console.log('');
        }
    });
})().catch(e => console.error('Error:', e.message));
