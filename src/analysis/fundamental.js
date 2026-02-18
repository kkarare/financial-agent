// ============================================
// 펀더멘털 분석 엔진
// 워런 버핏 스타일로 적정주가 괴리율을 분석합니다 🧠
// ============================================
const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config');

class FundamentalAnalysis {
    constructor() {
        this.genAI = null;
    }

    initAI() {
        if (!this.genAI && config.geminiApiKey) {
            this.genAI = new GoogleGenerativeAI(config.geminiApiKey);
        }
    }

    // 적정주가 계산 (다중 모델 평균)
    calculateFairValue(fundamentals) {
        const estimates = [];

        // 방법 1: EPS × 적정 PER (업종 평균 PER 기준)
        if (fundamentals.eps > 0 && fundamentals.per > 0) {
            // 적정 PER을 업종 평균 또는 15배(시장 평균)로 설정
            const fairPER = Math.min(fundamentals.per, 20); // 보수적 PER 캡
            estimates.push({
                method: 'EPS × 적정PER',
                value: fundamentals.eps * fairPER,
            });
        }

        // 방법 2: BPS × ROE / 요구수익률 (잔여이익모델)
        if (fundamentals.bps > 0 && fundamentals.roe > 0) {
            const requiredReturn = 10; // 요구수익률 10%
            const fairValue = fundamentals.bps * (fundamentals.roe / requiredReturn);
            estimates.push({
                method: 'BPS × ROE/요구수익률',
                value: fairValue,
            });
        }

        // 방법 3: PBR 기반 (PBR 1배 기준)
        if (fundamentals.bps > 0) {
            estimates.push({
                method: 'BPS (PBR=1)',
                value: fundamentals.bps,
            });
        }

        if (estimates.length === 0) return null;

        // 가중 평균 적정주가
        const avgFairValue = estimates.reduce((sum, e) => sum + e.value, 0) / estimates.length;

        return {
            estimates,
            avgFairValue: Math.round(avgFairValue),
        };
    }

    // 괴리율 계산 및 매수/매도/보유 의견
    calculateGapAndOpinion(currentPrice, fairValue) {
        if (!fairValue || fairValue === 0) return { gap: 0, opinion: '분석불가' };

        const gap = ((currentPrice - fairValue) / fairValue * 100).toFixed(2);
        let opinion;

        if (gap <= -20) {
            opinion = '🟢 매수 (저평가)';
        } else if (gap >= 20) {
            opinion = '🔴 매도 (고평가)';
        } else if (gap <= -10) {
            opinion = '🟢 매수 고려';
        } else if (gap >= 10) {
            opinion = '🟡 매도 고려';
        } else {
            opinion = '⚪ 보유';
        }

        return { gap: parseFloat(gap), opinion };
    }

    // 포트폴리오 전체 분석
    async analyzePortfolio(portfolioWithData) {
        this.initAI();
        console.log('🧠 펀더멘털 분석 시작...');

        const analysisResults = [];

        for (const item of portfolioWithData) {
            const result = {
                name: item.name,
                ticker: item.ticker,
                quantity: item.quantity,
                avgPrice: item.avgPrice,
                currentPrice: item.currentPrice || (item.fundamentals?.currentPrice || 0),
                accountType: item.accountType,
                isOverseas: item.isOverseas,
                fundamentals: item.fundamentals,
            };

            if (item.fundamentals) {
                // 적정주가 계산
                const fairValueResult = this.calculateFairValue(item.fundamentals);
                result.fairValue = fairValueResult;

                // 괴리율 및 의견
                if (fairValueResult) {
                    const { gap, opinion } = this.calculateGapAndOpinion(
                        result.currentPrice,
                        fairValueResult.avgFairValue
                    );
                    result.gap = gap;
                    result.opinion = opinion;
                } else {
                    result.gap = null;
                    result.opinion = '데이터 부족';
                }
            } else {
                result.opinion = '데이터 수집 실패';
            }

            // 수익률 계산
            if (result.avgPrice > 0) {
                result.returnRate = ((result.currentPrice - result.avgPrice) / result.avgPrice * 100).toFixed(2);
            }

            analysisResults.push(result);
        }

        // Gemini AI로 종합 분석 코멘트 생성
        if (this.genAI) {
            try {
                const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

                const portfolioSummary = analysisResults.map(r =>
                    `${r.name}(${r.ticker}): 현재가 ${r.currentPrice}, 적정가 ${r.fairValue?.avgFairValue || '?'}, 괴리율 ${r.gap || '?'}%, 의견: ${r.opinion}, 수익률: ${r.returnRate || '?'}%`
                ).join('\n');

                const prompt = `당신은 워런 버핏의 가치투자 철학을 따르는 재무 전문가입니다.

아래는 투자자의 포트폴리오 분석 결과입니다:

${portfolioSummary}

다음을 수행해 주세요:
1. 전체 포트폴리오의 건강도를 평가 (A~F 등급)
2. 리스크가 높은 종목 경고
3. 워런 버핏의 관점에서 포트폴리오 조언
4. 가장 주의해야 할 종목 TOP 3 (이유 포함)

간결하고 핵심적으로 3-5줄 이내로 답변해 주세요.`;

                const result = await model.generateContent(prompt);
                const aiComment = result.response.text();

                return {
                    stocks: analysisResults,
                    aiComment,
                    analyzedAt: new Date().toISOString(),
                };
            } catch (error) {
                console.error('⚠️ AI 코멘트 생성 실패:', error.message);
            }
        }

        return {
            stocks: analysisResults,
            aiComment: 'AI 분석 비활성화 (API Key 확인 필요)',
            analyzedAt: new Date().toISOString(),
        };
    }
}

module.exports = new FundamentalAnalysis();
