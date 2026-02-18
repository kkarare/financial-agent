// ============================================
// 주가·재무 데이터 수집 모듈
// 국내/해외 주식의 펀더멘털 데이터를 가져옵니다 📈
// ============================================
const axios = require('axios');
const cheerio = require('cheerio');

class StockData {
    // 국내 주식 재무 데이터 수집 (네이버 금융)
    async getKoreanStockData(ticker) {
        try {
            // 티커에서 KRX: 접두사 제거
            const cleanTicker = ticker.replace('KRX:', '');
            const url = `https://finance.naver.com/item/main.nhn?code=${cleanTicker}`;

            const response = await axios.get(url, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
            });
            const $ = cheerio.load(response.data);

            // 현재가 파싱
            const currentPrice = parseInt($('.no_today .blind').first().text().replace(/,/g, '')) || 0;

            // 재무 데이터 수집 (네이버 금융 요약 영역)
            const fundamentals = {
                ticker: cleanTicker,
                currentPrice,
                per: 0,
                pbr: 0,
                roe: 0,
                eps: 0,
                bps: 0,
                dividendYield: 0,
                marketCap: '',
            };

            // 투자정보 테이블에서 PER, EPS, PBR, BPS 등 추출
            const $table = $('#tab_con1 table');
            $table.find('tr').each((_, row) => {
                const tds = $(row).find('td, th');
                tds.each((idx, td) => {
                    const text = $(td).text().trim();
                    if (text.includes('PER')) {
                        const val = $(tds[idx + 1]).text().trim();
                        fundamentals.per = parseFloat(val) || 0;
                    }
                    if (text.includes('EPS')) {
                        const val = $(tds[idx + 1]).text().trim().replace(/,/g, '');
                        fundamentals.eps = parseFloat(val) || 0;
                    }
                    if (text.includes('PBR')) {
                        const val = $(tds[idx + 1]).text().trim();
                        fundamentals.pbr = parseFloat(val) || 0;
                    }
                    if (text.includes('BPS')) {
                        const val = $(tds[idx + 1]).text().trim().replace(/,/g, '');
                        fundamentals.bps = parseFloat(val) || 0;
                    }
                    if (text.includes('ROE')) {
                        const val = $(tds[idx + 1]).text().trim();
                        fundamentals.roe = parseFloat(val) || 0;
                    }
                });
            });

            return fundamentals;
        } catch (error) {
            console.error(`❌ 국내 주식 데이터 수집 실패 (${ticker}):`, error.message);
            return null;
        }
    }

    // 해외(미국) 주식 재무 데이터 수집 (Yahoo Finance)
    async getUSStockData(ticker) {
        try {
            // Yahoo Finance API (비공식 엔드포인트)
            const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=defaultKeyStatistics,financialData,price,summaryDetail`;

            const response = await axios.get(url, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
            });

            const result = response.data.quoteSummary.result[0];
            const keyStats = result.defaultKeyStatistics || {};
            const financial = result.financialData || {};
            const price = result.price || {};
            const summary = result.summaryDetail || {};

            return {
                ticker,
                currentPrice: price.regularMarketPrice?.raw || 0,
                per: keyStats.trailingPE?.raw || keyStats.forwardPE?.raw || 0,
                pbr: keyStats.priceToBook?.raw || 0,
                roe: financial.returnOnEquity?.raw ? (financial.returnOnEquity.raw * 100).toFixed(2) : 0,
                eps: keyStats.trailingEps?.raw || 0,
                bps: keyStats.bookValue?.raw || 0,
                dividendYield: summary.dividendYield?.raw ? (summary.dividendYield.raw * 100).toFixed(2) : 0,
                marketCap: price.marketCap?.fmt || '',
                currency: 'USD',
            };
        } catch (error) {
            console.error(`❌ 미국 주식 데이터 수집 실패 (${ticker}):`, error.message);
            return null;
        }
    }

    // ETF 데이터 수집 (국내 ETF)
    async getKoreanETFData(ticker) {
        try {
            const cleanTicker = ticker.replace('KRX:', '');
            const url = `https://finance.naver.com/item/main.nhn?code=${cleanTicker}`;

            const response = await axios.get(url, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
            });
            const $ = cheerio.load(response.data);

            const currentPrice = parseInt($('.no_today .blind').first().text().replace(/,/g, '')) || 0;

            return {
                ticker: cleanTicker,
                currentPrice,
                isETF: true,
                // ETF는 PER/ROE 대신 NAV, 추적오차 등을 분석
                per: 0,
                pbr: 0,
                roe: 0,
            };
        } catch (error) {
            console.error(`❌ ETF 데이터 수집 실패 (${ticker}):`, error.message);
            return null;
        }
    }

    // 포트폴리오 전체 종목의 재무 데이터 수집
    async getAllStockData(portfolio) {
        console.log('📈 전체 포트폴리오 재무 데이터 수집 중...');
        const results = [];

        for (const item of portfolio) {
            let data;

            if (item.isOverseas) {
                // 미국 주식
                data = await this.getUSStockData(item.ticker);
            } else if (item.ticker.includes('KRX:')) {
                // KRX 접두사 있는 종목
                data = await this.getKoreanStockData(item.ticker);
            } else {
                // 국내 주식/ETF
                data = await this.getKoreanStockData(item.ticker);
            }

            if (data) {
                results.push({ ...item, fundamentals: data });
            } else {
                results.push({ ...item, fundamentals: null });
            }

            // API 부하 방지를 위한 딜레이
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        console.log(`✅ ${results.length}개 종목 데이터 수집 완료`);
        return results;
    }
}

module.exports = new StockData();
