// ============================================
// 테스트 실행 스크립트
// 각 모듈을 개별적으로 테스트합니다 🧪
// ============================================
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const testModule = process.argv[2];

async function runTest() {
    console.log('🧪 테스트 실행기 시작\n');

    switch (testModule) {
        case 'sheets': {
            console.log('📊 [테스트] Google Sheets 데이터 읽기');
            const reader = require('../src/sheets/reader');
            const portfolio = await reader.getPortfolio();
            console.log('\n=== 포트폴리오 데이터 ===');
            console.table(portfolio.map(p => ({
                종목명: p.name,
                티커: p.ticker,
                수량: p.quantity,
                매수가: p.avgPrice,
                현재가: p.currentPrice,
                수익률: p.returnRate + '%',
                계좌: p.accountType,
                해외: p.isOverseas ? '✓' : '',
            })));
            break;
        }

        case 'market': {
            console.log('📈 [테스트] 시장 데이터 수집');
            const stockData = require('../src/market/stockData');
            // 테스트: 삼성전자, 테슬라
            const kr = await stockData.getKoreanStockData('005930');
            console.log('\n삼성전자 재무 데이터:', kr);
            const us = await stockData.getUSStockData('TSLA');
            console.log('\n테슬라 재무 데이터:', us);
            break;
        }

        case 'analysis': {
            console.log('🧠 [테스트] 펀더멘털 분석');
            const fundamental = require('../src/analysis/fundamental');
            // 간이 테스트 데이터
            const testData = [{
                name: '테스트종목', ticker: '005930', quantity: 100,
                avgPrice: 70000, currentPrice: 75000, isOverseas: false,
                accountType: '일반',
                fundamentals: { per: 12, pbr: 1.2, roe: 10, eps: 6000, bps: 60000, currentPrice: 75000 },
            }];
            const result = await fundamental.analyzePortfolio(testData);
            console.log('\n분석 결과:', JSON.stringify(result, null, 2));
            break;
        }

        case 'news': {
            console.log('📰 [테스트] 뉴스 수집');
            const newsCollector = require('../src/market/newsCollector');
            const news = await newsCollector.searchNews('삼성전자', 3);
            console.log('\n수집된 뉴스:', news);
            break;
        }

        case 'email': {
            console.log('📧 [테스트] 이메일 발송');
            const emailSender = require('../src/email/sender');
            const sent = await emailSender.send({
                subject: '🧪 [테스트] 대박이 재무부장 이메일 테스트',
                html: emailSender._wrapHtml('테스트', '# 테스트 성공! 🎉\n\n이 메일은 대박이 재무 분석 AI 에이전트의 테스트 메일입니다.\n\n**충성! 시스템이 정상 작동합니다!** 🫡'),
            });
            console.log('\n이메일 발송 결과:', sent ? '✅ 성공' : '❌ 실패');
            break;
        }

        case 'ipo-collect': {
            console.log('📋 [테스트] 공모주 일정 수집');
            const collector = require('../src/ipo/ipoCollector');
            const list = await collector.getIpoSchedule();
            console.log('\n=== 공모주 일정 ===');
            console.table(list);
            break;
        }

        case 'ipo-analyze': {
            console.log('📊 [테스트] 공모주 분석');
            const collector = require('../src/ipo/ipoCollector');
            const analyzer = require('../src/ipo/ipoAnalyzer');
            const list = await collector.getIpoSchedule();
            if (list.length > 0) {
                const firstIpo = list[0];
                const detail = await collector.getIpoDetail(firstIpo.name);
                const analysis = await analyzer.analyze(firstIpo, detail, null);
                console.log('\n분석 결과:', JSON.stringify(analysis, null, 2));
            } else {
                console.log('분석할 공모주가 없습니다.');
            }
            break;
        }

        case 'ipo-calendar': {
            console.log('📅 [테스트] Google Calendar 등록');
            console.log('이 테스트는 실제 캘린더에 이벤트를 등록합니다.');
            console.log('서비스 계정 JSON과 Calendar ID가 필요합니다.');
            const ipoCalendar = require('../src/ipo/ipoCalendar');
            await ipoCalendar.init();
            console.log('Calendar API 초기화 결과:', ipoCalendar.initialized ? '✅ 성공' : '❌ 실패');
            break;
        }

        case 'ipo-profit': {
            console.log('💹 [테스트] 공모주 수익 집계');
            const tracker = require('../src/ipo/ipoProfitTracker');
            const summary = await tracker.generateProfitSummary();
            console.log('\n=== 수익 현황 ===');
            console.log(tracker.formatReport(summary));
            break;
        }

        case 'weekly': {
            console.log('📊 [테스트] 주간 전체 리포트 (통합)');
            console.log('⏳ 이 테스트는 시간이 걸릴 수 있습니다...');
            // index.js의 runWeeklyReport를 직접 호출
            process.argv.push('--run', 'weekly');
            require('../src/index');
            return; // index.js가 실행되므로 리턴
        }

        case 'daily': {
            console.log('☀️ [테스트] 일간 이슈 리포트 (통합)');
            process.argv.push('--run', 'daily');
            require('../src/index');
            return;
        }

        default:
            console.log('❌ 알 수 없는 테스트 모듈:', testModule);
            console.log('\n사용법: node test/test-run.js <모듈명>');
            console.log('\n사용 가능한 모듈:');
            console.log('  sheets       - Google Sheets 데이터 읽기');
            console.log('  market       - 시장 데이터 수집');
            console.log('  analysis     - 펀더멘털 분석');
            console.log('  news         - 뉴스 수집');
            console.log('  email        - 이메일 발송');
            console.log('  ipo-collect  - 공모주 일정 수집');
            console.log('  ipo-analyze  - 공모주 분석');
            console.log('  ipo-calendar - Google Calendar 등록');
            console.log('  ipo-profit   - 공모주 수익 집계');
            console.log('  weekly       - 주간 전체 리포트');
            console.log('  daily        - 일간 이슈 리포트');
            break;
    }

    console.log('\n🧪 테스트 완료!');
}

runTest().catch(console.error);
