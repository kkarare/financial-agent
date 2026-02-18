// 네이버 뉴스 HTML 구조 디버깅
const axios = require('axios');
const cheerio = require('cheerio');

(async () => {
    const r = await axios.get('https://search.naver.com/search.naver?where=news&query=삼성전자&sort=1', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
    });
    const $ = cheerio.load(r.data);

    const selectors = [
        'a.news_tit',
        'a.info_title',
        '.news_area a',
        'a[class*="title"]',
        '.list_news a',
        '.bx a',
    ];

    for (const s of selectors) {
        const count = $(s).length;
        if (count > 0) {
            console.log(`${s}: ${count}개`);
            $(s).each((i, el) => {
                if (i < 2) console.log(`  ${$(el).text().substring(0, 60)}`);
            });
        }
    }

    // 전체 링크 중 뉴스 관련 찾기
    console.log('\n--- href에 news 포함된 링크 ---');
    $('a').each((i, el) => {
        const href = $(el).attr('href') || '';
        const text = $(el).text().trim();
        if (href.includes('news.naver') && text.length > 10 && i < 20) {
            console.log(`${text.substring(0, 60)} | class: ${$(el).attr('class') || 'none'}`);
        }
    });
})().catch(e => console.error('Error:', e.message));
