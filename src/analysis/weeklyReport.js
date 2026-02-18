// ============================================
// 주간 종합 리포트 생성 모듈
// 매주 월요일 오전 7시에 대표님께 보고드립니다 📋
// ============================================
const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config');
const sheetsWriter = require('../sheets/writer');

class WeeklyReport {
    constructor() {
        this.genAI = null;
    }

    initAI() {
        if (!this.genAI && config.geminiApiKey) {
            this.genAI = new GoogleGenerativeAI(config.geminiApiKey);
        }
    }

    // 주간 종합 리포트 생성
    async generate(analysisResult, newsResult, policyResult) {
        this.initAI();
        console.log('📋 주간 종합 리포트 생성 중...');

        if (!this.genAI) {
            return this._generateBasicReport(analysisResult, newsResult);
        }

        try {
            const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

            // 분석 결과를 텍스트로 변환
            const stocksSummary = analysisResult.stocks.map(s =>
                `${s.name}: 현재가 ${s.currentPrice}, 괴리율 ${s.gap || '?'}%, 의견 ${s.opinion}, 수익률 ${s.returnRate || '?'}%`
            ).join('\n');

            const newsText = newsResult?.keyIssues?.map(i =>
                `- ${i.title}: ${i.summary} [영향: ${i.impact}, 중요도: ${i.significance}]`
            ).join('\n') || '뉴스 데이터 없음';

            const policyText = policyResult?.highlights?.map(p =>
                `- ${p.channel}: ${p.summary}`
            ).join('\n') || '정책 데이터 없음';

            const prompt = `당신은 워런 버핏의 가치투자 철학을 존경하는 재무 전문가입니다.
1인 기업가에게 매주 월요일 아침에 보내는 주간 투자 브리핑을 작성해 주세요.

**포트폴리오 분석:**
${stocksSummary}

**주간 핵심 이슈:**
${newsText}

**정부 정책 동향:**
${policyText}

다음 형식으로 작성해 주세요:

## 📊 이번 주 포트폴리오 진단
(전체 포트폴리오 건강도, 주의 종목, 추천 액션)

## 📰 주간 핵심 이슈 TOP 5
(기업 가치에 영향을 주는 핵심 이슈만, 번호 목록)

## 🏛️ 정부 정책 하이라이트
(내 자산에 영향을 미칠 수 있는 정책 발언)

## 💡 워런 버핏의 한마디
(이번 주 시장 상황에 맞는 버핏의 명언 1개)

## ⚡ 이번 주 액션 아이템
(구체적인 매수/매도/보유 추천)

간결하되 핵심 정보는 빠짐없이 포함해 주세요.`;

            const result = await model.generateContent(prompt);
            const reportContent = result.response.text();

            // 주간 이슈 시트에 기록
            const today = new Date().toISOString().split('T')[0];
            try {
                await sheetsWriter.addWeeklyIssue(
                    today,
                    newsResult?.keyIssues?.map(i => i.title).join('; ') || '',
                    analysisResult.aiComment?.substring(0, 200) || ''
                );
            } catch (e) {
                // 시트 기록 실패해도 리포트는 계속 생성
            }

            return {
                content: reportContent,
                generatedAt: new Date().toISOString(),
                type: 'weekly',
            };
        } catch (error) {
            console.error('❌ 주간 리포트 생성 실패:', error.message);
            return this._generateBasicReport(analysisResult, newsResult);
        }
    }

    // AI 없이 기본 리포트 생성 (폴백)
    _generateBasicReport(analysisResult, newsResult) {
        const lines = ['# 주간 포트폴리오 리포트\n'];

        lines.push('## 📊 보유 종목 진단\n');
        lines.push('| 종목명 | 현재가 | 괴리율 | 의견 | 수익률 |');
        lines.push('|--------|--------|--------|------|--------|');

        for (const s of analysisResult.stocks) {
            lines.push(`| ${s.name} | ${s.currentPrice} | ${s.gap || '-'}% | ${s.opinion} | ${s.returnRate || '-'}% |`);
        }

        return {
            content: lines.join('\n'),
            generatedAt: new Date().toISOString(),
            type: 'weekly',
        };
    }
}

module.exports = new WeeklyReport();
