// ============================================
// 일간 이슈 요약 모듈
// 매일 아침 7시에 전날의 핵심 이슈를 요약합니다 ☀️
// ============================================
const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config');
const newsCollector = require('../market/newsCollector');

class DailyIssue {
    constructor() {
        this.genAI = null;
    }

    initAI() {
        if (!this.genAI && config.geminiApiKey) {
            this.genAI = new GoogleGenerativeAI(config.geminiApiKey);
        }
    }

    // 일간 이슈 수집 및 요약
    async generate(portfolio) {
        this.initAI();
        console.log('☀️ 일간 이슈 요약 생성 중...');

        // 뉴스 수집
        const allNews = await newsCollector.collectPortfolioNews(portfolio);

        if (!this.genAI) {
            return this._generateBasicSummary(allNews);
        }

        try {
            const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

            const portfolioNames = portfolio.map(p => `${p.name}(${p.ticker})`).join(', ');
            const newsText = Object.entries(allNews)
                .map(([name, articles]) =>
                    `[${name}]\n${articles.map(a => `- ${a.title}`).join('\n')}`
                ).join('\n\n');

            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const dateStr = yesterday.toLocaleDateString('ko-KR');

            const prompt = `당신은 워런 버핏의 가치투자 철학을 따르는 재무 분석 전문가입니다.

${dateStr}의 주요 뉴스를 분석하여 "일간 투자 브리핑"을 작성해 주세요.

**보유 종목:** ${portfolioNames}

**전일 뉴스:**
${newsText}

다음 형식으로 간결하게 작성해 주세요:

## ☀️ ${dateStr} 일간 투자 브리핑

### 🌍 글로벌 시장 동향
(미국/유럽/아시아 시장 요약, 2-3줄)

### 🇰🇷 국내 시장 동향
(코스피/코스닥 요약, 2-3줄)

### 📌 내 포트폴리오 관련 이슈
(보유 종목에 직접 영향 있는 이슈만, 번호 목록)

### ⚡ 오늘의 관전 포인트
(오늘 주목해야 할 것 1-2가지)

핵심만 쏙쏙 뽑아서 2분 이내로 읽을 수 있게 작성해 주세요.`;

            const result = await model.generateContent(prompt);
            const content = result.response.text();

            return {
                content,
                generatedAt: new Date().toISOString(),
                type: 'daily',
                newsCount: Object.values(allNews).flat().length,
            };
        } catch (error) {
            console.error('❌ 일간 이슈 생성 실패:', error.message);
            return this._generateBasicSummary(allNews);
        }
    }

    // AI 없이 기본 요약 생성
    _generateBasicSummary(allNews) {
        const lines = ['# 일간 이슈 요약\n'];

        for (const [category, articles] of Object.entries(allNews)) {
            lines.push(`\n## ${category}`);
            for (const article of articles) {
                lines.push(`- ${article.title}`);
            }
        }

        return {
            content: lines.join('\n'),
            generatedAt: new Date().toISOString(),
            type: 'daily',
        };
    }
}

module.exports = new DailyIssue();
