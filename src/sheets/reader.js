// ============================================
// Google Sheets 데이터 읽기 모듈
// 대표님의 포트폴리오를 정확하게 읽어옵니다 📊
// ============================================
const { google } = require('googleapis');
const config = require('../config');

class SheetsReader {
    constructor() {
        this.sheets = null;
        this.initialized = false;
    }

    // Google Sheets API 인증 및 초기화
    async init() {
        if (this.initialized) return;

        try {
            // 서비스 계정 JSON이 있으면 사용, 없으면 API Key 방식
            const fs = require('fs');
            if (fs.existsSync(config.google.serviceAccountPath)) {
                const auth = new google.auth.GoogleAuth({
                    keyFile: config.google.serviceAccountPath,
                    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
                });
                this.sheets = google.sheets({ version: 'v4', auth });
            } else {
                // 공개 스프레드시트는 API Key로 접근 가능
                this.sheets = google.sheets({
                    version: 'v4',
                    auth: config.geminiApiKey, // Google API Key 사용
                });
            }
            this.initialized = true;
            console.log('✅ Google Sheets API 연결 성공');
        } catch (error) {
            console.error('❌ Google Sheets API 연결 실패:', error.message);
            throw error;
        }
    }

    // 포트폴리오 데이터 읽기
    async getPortfolio() {
        await this.init();

        try {
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: config.spreadsheetId,
                range: `${config.sheets.portfolio}!A:H`,
            });

            const rows = response.data.values;
            if (!rows || rows.length <= 1) {
                console.warn('⚠️ 포트폴리오 데이터가 비어있습니다.');
                return [];
            }

            const headers = rows[0]; // 헤더 행
            const portfolio = [];

            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (!row[0]) continue; // 종목명이 없으면 건너뛰기

                const item = {
                    name: row[0] || '',                          // 종목명
                    ticker: row[1] || '',                        // 티커(코드)
                    quantity: parseFloat(row[2]) || 0,           // 보유수량
                    avgPrice: parseFloat(String(row[3]).replace(/,/g, '')) || 0,  // 평균매수가
                    currentPrice: parseFloat(String(row[4]).replace(/,/g, '')) || 0, // 현재가
                    evalAmount: parseFloat(String(row[5]).replace(/,/g, '')) || 0,  // 평가금액
                    returnRate: parseFloat(String(row[6]).replace(/%/g, '')) || 0,  // 수익률
                    investNote: row[7] || '',                    // 투자 원칙(매수이유)
                };

                // 국내/해외 구분 (티커가 영문이면 해외)
                item.isOverseas = /^[A-Z]+$/.test(item.ticker);
                // 계좌 유형 추출 (투자 원칙에서 괄호 안 내용)
                const accountMatch = item.investNote.match(/\((.+?)\)/);
                item.accountType = accountMatch ? accountMatch[1] : '일반';

                portfolio.push(item);
            }

            console.log(`📊 포트폴리오 ${portfolio.length}개 종목 로드 완료`);
            return portfolio;
        } catch (error) {
            console.error('❌ 포트폴리오 읽기 실패:', error.message);
            throw error;
        }
    }

    // 주간 이슈 시트 데이터 읽기
    async getWeeklyIssues() {
        await this.init();

        try {
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: config.spreadsheetId,
                range: `${config.sheets.weeklyIssue}!A:C`,
            });
            return response.data.values || [];
        } catch (error) {
            console.warn('⚠️ 주간 이슈 시트 읽기 실패:', error.message);
            return [];
        }
    }

    // 공모주 투자 기록 읽기
    async getIpoRecords() {
        await this.init();

        try {
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: config.spreadsheetId,
                range: `${config.sheets.ipoRecord}!A:J`,
            });

            const rows = response.data.values;
            if (!rows || rows.length <= 1) return [];

            const records = [];
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (!row[0]) continue;

                records.push({
                    name: row[0] || '',           // 종목명
                    subDate: row[1] || '',        // 청약일
                    ipoPrice: parseFloat(String(row[2]).replace(/,/g, '')) || 0, // 공모가
                    allocated: parseInt(row[3]) || 0,  // 배정수량
                    invested: parseFloat(String(row[4]).replace(/,/g, '')) || 0, // 투자금액
                    sellPrice: parseFloat(String(row[5]).replace(/,/g, '')) || 0, // 판매가
                    sellDate: row[6] || '',       // 판매일
                    profit: parseFloat(String(row[7]).replace(/,/g, '')) || 0,   // 수익금
                    returnRate: parseFloat(String(row[8]).replace(/%/g, '')) || 0, // 수익률
                    grade: row[9] || '',          // 등급
                });
            }

            return records;
        } catch (error) {
            console.warn('⚠️ 공모주 기록 시트 없음 (최초 실행 시 자동 생성)');
            return [];
        }
    }
}

module.exports = new SheetsReader();
