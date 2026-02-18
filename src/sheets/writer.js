// ============================================
// Google Sheets 데이터 쓰기 모듈
// 공모주 기록, 주간 이슈 등을 시트에 기록합니다 ✍️
// ============================================
const { google } = require('googleapis');
const config = require('../config');

class SheetsWriter {
    constructor() {
        this.sheets = null;
        this.initialized = false;
    }

    // Google Sheets API 인증 (쓰기 권한)
    async init() {
        if (this.initialized) return;

        try {
            const auth = new google.auth.GoogleAuth({
                keyFile: config.google.serviceAccountPath,
                scopes: ['https://www.googleapis.com/auth/spreadsheets'],
            });
            this.sheets = google.sheets({ version: 'v4', auth });
            this.initialized = true;
            console.log('✅ Google Sheets 쓰기 API 연결 성공');
        } catch (error) {
            console.error('❌ Google Sheets 쓰기 API 연결 실패:', error.message);
            throw error;
        }
    }

    // 공모주 투자기록 시트 생성 (최초 1회)
    async createIpoSheet() {
        await this.init();

        try {
            // 시트 존재 여부 확인
            const spreadsheet = await this.sheets.spreadsheets.get({
                spreadsheetId: config.spreadsheetId,
            });
            const sheetNames = spreadsheet.data.sheets.map(s => s.properties.title);

            if (!sheetNames.includes(config.sheets.ipoRecord)) {
                // 시트 추가
                await this.sheets.spreadsheets.batchUpdate({
                    spreadsheetId: config.spreadsheetId,
                    requestBody: {
                        requests: [
                            {
                                addSheet: {
                                    properties: { title: config.sheets.ipoRecord },
                                },
                            },
                        ],
                    },
                });

                // 헤더 추가
                await this.sheets.spreadsheets.values.update({
                    spreadsheetId: config.spreadsheetId,
                    range: `${config.sheets.ipoRecord}!A1:J1`,
                    valueInputOption: 'RAW',
                    requestBody: {
                        values: [['종목명', '청약일', '공모가', '배정수량', '투자금액', '판매가', '판매일', '수익금', '수익률(%)', '등급(AI분석)']],
                    },
                });

                console.log('✅ 공모주_투자기록 시트 생성 완료');
            }

            // 월간수익 시트도 생성
            if (!sheetNames.includes(config.sheets.ipoMonthly)) {
                await this.sheets.spreadsheets.batchUpdate({
                    spreadsheetId: config.spreadsheetId,
                    requestBody: {
                        requests: [
                            {
                                addSheet: {
                                    properties: { title: config.sheets.ipoMonthly },
                                },
                            },
                        ],
                    },
                });

                await this.sheets.spreadsheets.values.update({
                    spreadsheetId: config.spreadsheetId,
                    range: `${config.sheets.ipoMonthly}!A1:F1`,
                    valueInputOption: 'RAW',
                    requestBody: {
                        values: [['년월', '총투자금', '총수익금', '수익률(%)', '거래건수', '평균등급']],
                    },
                });

                console.log('✅ 공모주_월간수익 시트 생성 완료');
            }
        } catch (error) {
            console.error('❌ IPO 시트 생성 실패:', error.message);
            throw error;
        }
    }

    // 공모주 투자 기록 추가
    async addIpoRecord(record) {
        await this.init();

        try {
            const investedAmount = record.ipoPrice * record.allocated;
            const profit = record.sellPrice
                ? (record.sellPrice - record.ipoPrice) * record.allocated
                : 0;
            const returnRate = record.sellPrice
                ? (((record.sellPrice - record.ipoPrice) / record.ipoPrice) * 100).toFixed(2)
                : '';

            await this.sheets.spreadsheets.values.append({
                spreadsheetId: config.spreadsheetId,
                range: `${config.sheets.ipoRecord}!A:J`,
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values: [[
                        record.name,
                        record.subDate,
                        record.ipoPrice,
                        record.allocated,
                        investedAmount,
                        record.sellPrice || '',
                        record.sellDate || '',
                        profit || '',
                        returnRate,
                        record.grade || '',
                    ]],
                },
            });

            console.log(`✅ 공모주 기록 추가: ${record.name}`);
        } catch (error) {
            console.error('❌ 공모주 기록 추가 실패:', error.message);
            throw error;
        }
    }

    // 주간 이슈 시트에 기록
    async addWeeklyIssue(date, issue, impact) {
        await this.init();

        try {
            await this.sheets.spreadsheets.values.append({
                spreadsheetId: config.spreadsheetId,
                range: `${config.sheets.weeklyIssue}!A:C`,
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values: [[date, issue, impact]],
                },
            });
        } catch (error) {
            console.error('❌ 주간 이슈 기록 실패:', error.message);
        }
    }

    // 월간 수익 집계 업데이트
    async updateMonthlyProfit(records) {
        await this.init();

        try {
            // 월별로 그룹핑
            const monthly = {};
            for (const rec of records) {
                if (!rec.sellDate || !rec.sellPrice) continue;
                const yearMonth = rec.sellDate.substring(0, 7); // YYYY-MM
                if (!monthly[yearMonth]) {
                    monthly[yearMonth] = { invested: 0, profit: 0, count: 0, grades: [] };
                }
                monthly[yearMonth].invested += rec.ipoPrice * rec.allocated;
                monthly[yearMonth].profit += (rec.sellPrice - rec.ipoPrice) * rec.allocated;
                monthly[yearMonth].count += 1;
                if (rec.grade) monthly[yearMonth].grades.push(rec.grade);
            }

            // 시트 데이터 구성
            const rows = Object.entries(monthly)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([yearMonth, data]) => {
                    const returnRate = data.invested > 0
                        ? ((data.profit / data.invested) * 100).toFixed(2)
                        : '0';
                    const avgGrade = data.grades.length > 0 ? data.grades.join('/') : '-';
                    return [yearMonth, data.invested, data.profit, returnRate, data.count, avgGrade];
                });

            if (rows.length > 0) {
                // 기존 데이터 클리어 후 재작성
                await this.sheets.spreadsheets.values.update({
                    spreadsheetId: config.spreadsheetId,
                    range: `${config.sheets.ipoMonthly}!A2:F${rows.length + 1}`,
                    valueInputOption: 'USER_ENTERED',
                    requestBody: { values: rows },
                });
                console.log('✅ 월간 수익 집계 업데이트 완료');
            }
        } catch (error) {
            console.error('❌ 월간 수익 업데이트 실패:', error.message);
        }
    }
}

module.exports = new SheetsWriter();
