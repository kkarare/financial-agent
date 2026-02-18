// ============================================
// 뉴스/이슈 수집 모듈
// 보유 종목 관련 핵심 뉴스를 가져옵니다 📰
// ============================================
const axios = require('axios');
const cheerio = require('cheerio');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config');

class NewsCollector {
    constructor() {
        this.genAI = null;
    }

    initAI() {
        if (!this.genAI && config.geminiApiKey) {
            this.genAI = new GoogleGenerativeAI(config.geminiApiKey);
        }
    }

    // Google News RSS로 뉴스 수집 (안정적)
    async searchNews(keyword, count = 5) {
        try {
            // Google News RSS 피드 활용
            const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(keyword)}&hl=ko&gl=KR&ceid=KR:ko`;
            const response = await axios.get(rssUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                timeout: 10000,
            });

            const $ = cheerio.load(response.data, { xmlMode: true });
            const articles = [];

            $('item').each((idx, el) => {
                if (idx >= count) return false;
                const title = $(el).find('title').text().trim();
                const link = $(el).find('link').text().trim();
                const pubDate = $(el).find('pubDate').text().trim();

                if (title) {
                    articles.push({ title, url: link, date: pubDate });
                }
            });

            return articles;
        } catch (error) {
            console.error(`❌ 뉴스 수집 실패 (${keyword}):`, error.message);
            return [];
        }
    }

    // 포트폴리오 관련 전체 뉴스 수집
    async collectPortfolioNews(portfolio) {
        console.log('📰 포트폴리오 관련 뉴스 수집 중...');
        const allNews = {};

        // 종목별로 뉴스 수집
        for (const item of portfolio) {
            const keyword = item.name.replace(/KODEX |TIGER |ACE |1Q/, '').trim();
            const news = await this.searchNews(keyword, 3);
            if (news.length > 0) {
                allNews[item.name] = news;
            }
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        // 시장 전반 뉴스도 수집
        const marketNews = await this.searchNews('코스피 코스닥 시장', 5);
        allNews['시장 전반'] = marketNews;

        const usMarketNews = await this.searchNews('미국 증시 나스닥 S&P500', 5);
        allNews['미국 시장'] = usMarketNews;

        return allNews;
    }

    // Gemini AI로 뉴스 필터링 및 요약 (노이즈 제거)
    async filterAndSummarize(allNews, portfolio) {
        this.initAI();
        if (!this.genAI) {
            console.warn('⚠️ Gemini API Key가 없어 AI 요약을 건너뜁니다.');
            return allNews;
        }

        try {
            const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

            const portfolioNames = portfolio.map(p => p.name).join(', ');
            const newsText = Object.entries(allNews)
                .map(([name, articles]) =>
                    `[${name}]\n${articles.map(a => `- ${a.title}`).join('\n')}`
                ).join('\n\n');

            const prompt = `당신은 워런 버핏의 투자 철학을 따르는 재무 분석 전문가입니다.

아래는 투자 포트폴리오 관련 뉴스 목록입니다.

**보유 종목:** ${portfolioNames}

**수집된 뉴스:**
${newsText}

다음 기준으로 핵심 이슈만 필터링하고 요약해 주세요:
1. 시장의 소음(Noise)은 제거하고, 기업의 본질적 가치에 영향을 미치는 이슈만 선별
2. 거시경제(금리, 환율, 유가) 변화 중 실질적 영향이 있는 것만 포함
3. 각 이슈가 보유 종목에 미치는 영향을 간결하게 분석
4. 매수/매도/보유 관점에서의 시사점 제시

JSON 형식으로 응답해 주세요:
{
  "keyIssues": [
    {
      "title": "이슈 제목",
      "summary": "1-2줄 요약",
      "affectedStocks": ["영향받는 종목"],
      "impact": "긍정/부정/중립",
      "significance": "상/중/하"
    }
  ],
  "marketOverview": "시장 전반 요약 (2-3줄)"
}`;

            const result = await model.generateContent(prompt);
            const text = result.response.text();

            // JSON 파싱 (코드블록 제거)
            const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            return JSON.parse(jsonStr);
        } catch (error) {
            console.error('❌ AI 뉴스 분석 실패:', error.message);
            return { keyIssues: [], marketOverview: '분석 실패' };
        }
    }
}

module.exports = new NewsCollector();
