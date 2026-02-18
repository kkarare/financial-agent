// ============================================
// Google Calendar 공모주 일정 등록 모듈
// 청약일/환불일/상장일을 자동으로 등록합니다 📅
// ============================================
const { google } = require('googleapis');
const config = require('../config');

class IpoCalendar {
    constructor() {
        this.calendar = null;
        this.initialized = false;
    }

    // Google Calendar API 초기화
    async init() {
        if (this.initialized) return;

        try {
            const fs = require('fs');

            // 서비스 계정 JSON (환경변수) 우선 확인
            if (config.google.serviceAccountJson) {
                const auth = new google.auth.GoogleAuth({
                    credentials: config.google.serviceAccountJson,
                    scopes: ['https://www.googleapis.com/auth/calendar'],
                });
                this.calendar = google.calendar({ version: 'v3', auth });
                this.initialized = true;
                console.log('✅ Google Calendar API 연결 성공');
                return;
            }

            // 파일 확인
            if (!fs.existsSync(config.google.serviceAccountPath)) {
                console.warn('⚠️ 서비스 계정 JSON이 없어 캘린더 등록을 건너뜁니다.');
                return;
            }

            const auth = new google.auth.GoogleAuth({
                keyFile: config.google.serviceAccountPath,
                scopes: ['https://www.googleapis.com/auth/calendar'],
            });

            this.calendar = google.calendar({ version: 'v3', auth });
            this.initialized = true;
            console.log('✅ Google Calendar API 연결 성공');
        } catch (error) {
            console.error('❌ Google Calendar API 연결 실패:', error.message);
        }
    }

    // 날짜 문자열 파싱 (YYYY.MM.DD 또는 YYYY-MM-DD → Date)
    _parseDate(dateStr) {
        if (!dateStr) return null;
        const cleaned = dateStr.replace(/\./g, '-').replace(/[^0-9-~]/g, '').trim();
        // "2026-02-20~02-21" 형식 처리
        const parts = cleaned.split('~');
        const startDate = parts[0];
        const endDate = parts.length > 1 ? parts[1] : startDate;

        return { start: startDate, end: endDate };
    }

    // 공모주 일정 이벤트 등록
    async registerIpoEvents(ipoAnalysis) {
        await this.init();
        if (!this.calendar || !config.google.calendarId) {
            console.warn('⚠️ Calendar 설정이 없어 이벤트 등록을 건너뜁니다.');
            return;
        }

        const ipo = ipoAnalysis;
        const grade = ipo.analysis?.grade || '?';
        const gradeIcon = ipo.analysis?.gradeInfo?.icon || '📋';
        const predictedMax = ipo.analysis?.predictedHighPrice?.max || '미정';

        try {
            // 1. 청약일 이벤트
            if (ipo.subscriptionDate) {
                const dates = this._parseDate(ipo.subscriptionDate);
                if (dates) {
                    await this._createEvent({
                        summary: `📋 [${ipo.name}] 공모주 청약 (등급: ${gradeIcon}${grade})`,
                        description: this._buildDescription(ipo, '청약'),
                        startDate: dates.start,
                        endDate: dates.end,
                    });
                    console.log(`📅 청약일 등록: ${ipo.name}`);
                }
            }

            // 2. 상장일 이벤트
            if (ipo.listingDate) {
                const dates = this._parseDate(ipo.listingDate);
                if (dates) {
                    await this._createEvent({
                        summary: `🚀 [${ipo.name}] 상장일 (예측 최고가: ${predictedMax.toLocaleString ? predictedMax.toLocaleString() : predictedMax}원)`,
                        description: this._buildDescription(ipo, '상장'),
                        startDate: dates.start,
                        endDate: dates.end,
                    });
                    console.log(`📅 상장일 등록: ${ipo.name}`);
                }
            }

            // 3. 환불일 이벤트 (청약일 +2 영업일 추정)
            if (ipo.subscriptionDate) {
                const dates = this._parseDate(ipo.subscriptionDate);
                if (dates) {
                    const refundDate = this._addBusinessDays(dates.end || dates.start, 2);
                    if (refundDate) {
                        await this._createEvent({
                            summary: `💰 [${ipo.name}] 환불일`,
                            description: `공모주 청약 환불 예정일\n등급: ${grade}`,
                            startDate: refundDate,
                            endDate: refundDate,
                        });
                        console.log(`📅 환불일 등록: ${ipo.name}`);
                    }
                }
            }
        } catch (error) {
            console.error(`❌ 캘린더 이벤트 등록 실패 (${ipo.name}):`, error.message);
        }
    }

    // 이벤트 생성 헬퍼
    async _createEvent({ summary, description, startDate, endDate }) {
        try {
            await this.calendar.events.insert({
                calendarId: config.google.calendarId,
                requestBody: {
                    summary,
                    description,
                    start: { date: startDate },
                    end: { date: endDate || startDate },
                    reminders: {
                        useDefault: false,
                        overrides: [
                            { method: 'popup', minutes: 60 * 24 }, // 하루 전 알림
                            { method: 'popup', minutes: 60 },       // 1시간 전 알림
                        ],
                    },
                },
            });
        } catch (error) {
            throw error;
        }
    }

    // 이벤트 설명(description) 빌더
    _buildDescription(ipo, eventType) {
        const analysis = ipo.analysis || {};
        const lines = [];

        lines.push(`═══ ${ipo.name} 공모주 ${eventType} 정보 ═══\n`);
        lines.push(`📌 업종: ${ipo.category || '미상'}`);
        lines.push(`💰 공모가: ${ipo.ipoPrice || '미정'}`);
        lines.push(`📊 희망 공모가 밴드: ${ipo.priceRange || '미정'}`);

        if (ipo.detail) {
            lines.push(`\n🏢 기관경쟁률: ${ipo.detail.institutionalCompetition || '미공개'}`);
            lines.push(`🔒 의무보유확약: ${ipo.detail.lockupRatio || '미공개'}`);
            lines.push(`📝 주간사: ${ipo.detail.underwriter || '미상'}`);
        }

        lines.push(`\n═══ AI 분석 결과 ═══`);
        lines.push(`🏆 등급: ${analysis.gradeInfo?.icon || ''} ${analysis.grade || '?'}`);
        lines.push(`📈 예상 수익률: ${analysis.gradeInfo?.expectedReturn || '미정'}`);

        if (analysis.predictedHighPrice) {
            const min = analysis.predictedHighPrice.min?.toLocaleString?.() || '?';
            const max = analysis.predictedHighPrice.max?.toLocaleString?.() || '?';
            lines.push(`🎯 예측 최고가: ${min}원 ~ ${max}원`);
        }

        if (analysis.recommendation) {
            lines.push(`\n💡 추천: ${analysis.recommendation}`);
        }

        if (analysis.keyPoints?.length > 0) {
            lines.push('\n📋 핵심 포인트:');
            analysis.keyPoints.forEach((p, i) => lines.push(`  ${i + 1}. ${p}`));
        }

        return lines.join('\n');
    }

    // 영업일 추가 (주말 건너뛰기)
    _addBusinessDays(dateStr, days) {
        try {
            const date = new Date(dateStr);
            let added = 0;
            while (added < days) {
                date.setDate(date.getDate() + 1);
                const day = date.getDay();
                if (day !== 0 && day !== 6) added++;
            }
            return date.toISOString().split('T')[0];
        } catch {
            return null;
        }
    }
}

module.exports = new IpoCalendar();
