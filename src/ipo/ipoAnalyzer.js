// ============================================
// 공모주 금융분석 엔진
// 재무분석 + AI로 등급(S~E) 산출 및 최고가 예측 📊
// ============================================
const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config');

// 등급 정의
const GRADES = {
    S: { label: 'S', color: '#FFD700', icon: '🌟', desc: '압도적 성장성 + 높은 기관경쟁률', expectedReturn: '+100% 이상' },
    'A+': { label: 'A+', color: '#FFA500', icon: '⭐', desc: '강한 펀더멘털 + 기관 관심 높음', expectedReturn: '+50~100%' },
    A: { label: 'A', color: '#00C853', icon: '✅', desc: '양호한 재무 + 적정 공모가', expectedReturn: '+30~50%' },
    'B+': { label: 'B+', color: '#2979FF', icon: '🔵', desc: '평균 이상 + 일부 리스크', expectedReturn: '+15~30%' },
    B: { label: 'B', color: '#9E9E9E', icon: '⚪', desc: '평균적 수준', expectedReturn: '+0~15%' },
    C: { label: 'C', color: '#FFD600', icon: '🟡', desc: '재무 불안 요소 존재', expectedReturn: '±0% (보합~소폭↑)' },
    D: { label: 'D', color: '#FF6D00', icon: '🟠', desc: '고평가 우려 + 낮은 기관경쟁률', expectedReturn: '-10~0%' },
    E: { label: 'E', color: '#D50000', icon: '🔴', desc: '심각한 리스크 (적자, 과대 공모가)', expectedReturn: '-10% 이상 하락' },
};

class IpoAnalyzer {
    constructor() {
        this.genAI = null;
    }

    initAI() {
        if (!this.genAI && config.geminiApiKey) {
            this.genAI = new GoogleGenerativeAI(config.geminiApiKey);
        }
    }

    // 공모주 종합 분석
    async analyze(ipoData, detail, dartData) {
        this.initAI();
        console.log(`📊 공모주 분석 중: ${ipoData.name}`);

        if (!this.genAI) {
            return this._basicAnalysis(ipoData, detail);
        }

        try {
            const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

            const prompt = `당신은 한국 공모주(IPO) 전문 금융 분석가입니다. 워런 버핏의 가치투자 원칙을 기반으로 분석합니다.

## 분석 대상 공모주 정보

**기본 정보:**
- 종목명: ${ipoData.name}
- 업종: ${ipoData.category || '미상'}
- 공모가: ${ipoData.ipoPrice || '미정'}
- 희망 공모가 밴드: ${ipoData.priceRange || '미정'}
- 청약일: ${ipoData.subscriptionDate || '미정'}
- 상장 예정일: ${ipoData.listingDate || '미정'}

**기관 수요예측 결과:**
- 기관경쟁률: ${detail?.institutionalCompetition || '미공개'}
- 의무보유확약 비율: ${detail?.lockupRatio || '미공개'}
- 주간사: ${detail?.underwriter || '미상'}
- 총공모주식수: ${detail?.totalShares || '미상'}
- 공모금액: ${detail?.publicOffering || '미상'}

**DART 공시자료:**
${dartData?.disclosures?.map(d => `- ${d.title} (${d.date})`).join('\n') || '공시자료 미확인'}

## 분석 요청

다음 항목을 분석하고 JSON으로 응답해 주세요:

1. **등급 산출** (S, A+, A, B+, B, C, D, E 중 선택)
   - S: 압도적 성장성 + 기관경쟁률 1000:1 이상 + 확약비율 높음 → 예상 수익률 +100%↑
   - A+: 강한 펀더멘털 + 기관경쟁률 500:1↑ → +50~100%
   - A: 양호한 재무 + 적정 공모가 → +30~50%
   - B+: 평균 이상 + 일부 리스크 → +15~30%
   - B: 평균적 수준 → +0~15%
   - C: 재무 불안요소 → ±0%
   - D: 고평가 우려 → -10~0%
   - E: 심각한 리스크 → -10%↓

2. **상장시 예측 최고가** (원 단위, 범위로 제시)
3. **핵심 분석 포인트** (3가지)
4. **투자 추천 한줄평**

JSON 형식:
{
  "grade": "등급",
  "gradeReason": "등급 산출 근거 (2줄)",
  "predictedHighPrice": { "min": 숫자, "max": 숫자 },
  "predictedHighPriceReason": "예측 근거",
  "keyPoints": ["포인트1", "포인트2", "포인트3"],
  "recommendation": "투자 추천 한줄평",
  "riskLevel": "상/중/하",
  "financialSummary": "재무 요약 (매출, 영업이익, 부채비율 등)"
}`;

            const result = await model.generateContent(prompt);
            const text = result.response.text();
            const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            const analysis = JSON.parse(jsonStr);

            // 등급 메타 정보 추가
            const gradeInfo = GRADES[analysis.grade] || GRADES['B'];
            analysis.gradeInfo = gradeInfo;

            return {
                ...ipoData,
                detail,
                analysis,
                analyzedAt: new Date().toISOString(),
            };
        } catch (error) {
            console.error(`❌ 공모주 AI 분석 실패 (${ipoData.name}):`, error.message);
            return this._basicAnalysis(ipoData, detail);
        }
    }

    // AI 없이 기본 분석 (폴백)
    _basicAnalysis(ipoData, detail) {
        let grade = 'B';

        // 기관경쟁률 기반 간이 등급
        const competition = parseFloat(detail?.institutionalCompetition?.replace(/[^0-9.]/g, '')) || 0;
        if (competition >= 1000) grade = 'A+';
        else if (competition >= 500) grade = 'A';
        else if (competition >= 200) grade = 'B+';
        else if (competition >= 50) grade = 'B';
        else if (competition > 0) grade = 'C';

        return {
            ...ipoData,
            detail,
            analysis: {
                grade,
                gradeReason: `기관경쟁률 ${competition}:1 기준 간이 분석`,
                gradeInfo: GRADES[grade],
                predictedHighPrice: { min: 0, max: 0 },
                keyPoints: ['AI 분석 비활성화 - 간이 분석 결과'],
                recommendation: 'Gemini API Key 등록 후 상세 분석 가능',
            },
            analyzedAt: new Date().toISOString(),
        };
    }

    // 전체 공모주 리스트 분석
    async analyzeAll(ipoList, ipoCollector) {
        const results = [];

        for (const ipo of ipoList) {
            const detail = await ipoCollector.getIpoDetail(ipo.name);
            const dartData = await ipoCollector.getDartDisclosure(ipo.name);
            const analysis = await this.analyze(ipo, detail, dartData);
            results.push(analysis);

            // API 부하 방지
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        return results;
    }
}

// 등급 정보 외부 접근용
IpoAnalyzer.GRADES = GRADES;

module.exports = new IpoAnalyzer();
