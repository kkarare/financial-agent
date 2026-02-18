// ============================================
// 메인 진입점 + 스케줄러
// 모든 것을 오케스트라처럼 지휘합니다 🎼
// ============================================
const cron = require('node-cron');
const config = require('./config');

// 모듈 로드
const sheetsReader = require('./sheets/reader');
const sheetsWriter = require('./sheets/writer');
const stockData = require('./market/stockData');
const newsCollector = require('./market/newsCollector');
const fundamental = require('./analysis/fundamental');
const weeklyReport = require('./analysis/weeklyReport');
const dailyIssue = require('./analysis/dailyIssue');
const policyMonitor = require('./analysis/policyMonitor');
const ipoCollector = require('./ipo/ipoCollector');
const ipoAnalyzer = require('./ipo/ipoAnalyzer');
const ipoCalendar = require('./ipo/ipoCalendar');
const ipoProfitTracker = require('./ipo/ipoProfitTracker');
const reportGenerator = require('./report/generator');
const emailSender = require('./email/sender');

// ============================================
// 실행 함수들
// ============================================

// 📊 주간 종합 리포트 (매주 월요일 07:00)
async function runWeeklyReport() {
    console.log('\n' + '═'.repeat(50));
    console.log('📊 주간 종합 리포트 실행 시작');
    console.log('═'.repeat(50));

    try {
        // 1. 포트폴리오 데이터 읽기
        const portfolio = await sheetsReader.getPortfolio();
        console.log(`📋 ${portfolio.length}개 종목 로드`);

        // 2. 재무 데이터 수집
        const portfolioWithData = await stockData.getAllStockData(portfolio);

        // 3. 펀더멘털 분석
        const analysisResult = await fundamental.analyzePortfolio(portfolioWithData);

        // 4. 뉴스/이슈 수집 및 필터링
        const allNews = await newsCollector.collectPortfolioNews(portfolio);
        const newsResult = await newsCollector.filterAndSummarize(allNews, portfolio);

        // 5. 정부 정책 모니터링
        const policyResult = await policyMonitor.analyze(portfolio);

        // 6. 주간 리포트 생성
        const report = await weeklyReport.generate(analysisResult, newsResult, policyResult);

        // 7. HTML 리포트 생성
        const stocksHtml = reportGenerator.generateWeeklyHtml(
            analysisResult, newsResult, policyResult, report
        );

        // 8. 이메일 발송
        await emailSender.sendWeeklyReport(stocksHtml + '<br>' + (report.content || ''));

        // 9. 공모주 수익 집계 (있는 경우)
        const profitSummary = await ipoProfitTracker.generateProfitSummary();
        if (profitSummary.totalSummary?.totalTrades > 0) {
            const profitReport = ipoProfitTracker.formatReport(profitSummary);
            await emailSender.send({
                subject: `💹 [공모주 수익 현황] ${new Date().toLocaleDateString('ko-KR')}`,
                html: emailSender._wrapHtml('공모주 수익 현황', profitReport),
            });
        }

        console.log('✅ 주간 종합 리포트 완료!');
    } catch (error) {
        console.error('❌ 주간 리포트 실행 실패:', error);
    }
}

// ☀️ 일간 이슈 메일 (매일 07:00)
async function runDailyIssue() {
    console.log('\n' + '═'.repeat(50));
    console.log('☀️ 일간 이슈 리포트 실행 시작');
    console.log('═'.repeat(50));

    try {
        // 1. 포트폴리오 읽기
        const portfolio = await sheetsReader.getPortfolio();

        // 2. 일간 이슈 생성
        const issue = await dailyIssue.generate(portfolio);

        // 3. 이메일 발송
        await emailSender.sendDailyIssue(issue.content);

        console.log('✅ 일간 이슈 리포트 완료!');
    } catch (error) {
        console.error('❌ 일간 이슈 실행 실패:', error);
    }
}

// 🆕 공모주 모니터링 (매일 09:00)
async function runIpoMonitor() {
    console.log('\n' + '═'.repeat(50));
    console.log('🆕 공모주 모니터링 실행 시작');
    console.log('═'.repeat(50));

    try {
        // 1. 공모주 일정 수집
        const ipoList = await ipoCollector.getIpoSchedule();
        console.log(`📋 ${ipoList.length}개 공모주 일정 수집`);

        if (ipoList.length === 0) {
            console.log('ℹ️ 현재 진행 중인 공모주 없음');
            return;
        }

        // 2. 공모주 분석
        const analyses = await ipoAnalyzer.analyzeAll(ipoList, ipoCollector);

        // 3. Google Calendar에 등록
        for (const analysis of analyses) {
            await ipoCalendar.registerIpoEvents(analysis);
        }

        // 4. 공모주 리포트 이메일 발송
        const ipoHtml = reportGenerator.generateIpoHtml(analyses);
        await emailSender.sendIpoAlert(ipoHtml);

        // 5. 투자기록 시트 생성 (최초 1회)
        try {
            await sheetsWriter.createIpoSheet();
        } catch (e) {
            // 이미 존재하면 무시
        }

        console.log('✅ 공모주 모니터링 완료!');
    } catch (error) {
        console.error('❌ 공모주 모니터링 실패:', error);
    }
}

// ============================================
// 스케줄러 설정
// ============================================
function setupScheduler() {
    console.log('\n🎼 스케줄러 설정 중...');

    // 매주 월요일 오전 7시 - 주간 종합 리포트
    cron.schedule('0 7 * * 1', () => {
        console.log('⏰ [스케줄] 주간 종합 리포트 트리거');
        runWeeklyReport();
    }, { timezone: 'Asia/Seoul' });
    console.log('  ✅ 주간 리포트: 매주 월요일 07:00 (KST)');

    // 매일 오전 7시 - 일간 이슈 메일
    cron.schedule('0 7 * * *', () => {
        console.log('⏰ [스케줄] 일간 이슈 리포트 트리거');
        runDailyIssue();
    }, { timezone: 'Asia/Seoul' });
    console.log('  ✅ 일간 이슈: 매일 07:00 (KST)');

    // 매일 오전 9시 - 공모주 모니터링
    cron.schedule('0 9 * * *', () => {
        console.log('⏰ [스케줄] 공모주 모니터링 트리거');
        runIpoMonitor();
    }, { timezone: 'Asia/Seoul' });
    console.log('  ✅ 공모주 모니터링: 매일 09:00 (KST)');

    console.log('\n🎼 모든 스케줄 등록 완료! 대기 중...\n');
}

// ============================================
// CLI 수동 실행 지원
// ============================================
async function main() {
    console.log('═'.repeat(50));
    console.log('🐟 대박이 재무 분석 AI 에이전트 v1.0');
    console.log('   충성! 대표님의 투자를 지원합니다! 🫡');
    console.log('═'.repeat(50));

    // 환경변수 유효성 검사
    config.validate();

    // CLI 인자 확인
    const args = process.argv.slice(2);
    const runMode = args.find(a => a.startsWith('--run'))
        ? args[args.indexOf('--run') + 1] || args.find(a => a.startsWith('--run='))?.split('=')[1]
        : null;

    if (runMode) {
        console.log(`\n🔧 수동 실행 모드: ${runMode}`);

        switch (runMode) {
            case 'weekly':
                await runWeeklyReport();
                break;
            case 'daily':
                await runDailyIssue();
                break;
            case 'ipo':
                await runIpoMonitor();
                break;
            case 'all':
                await runWeeklyReport();
                await runDailyIssue();
                await runIpoMonitor();
                break;
            default:
                console.log('❌ 알 수 없는 실행 모드:', runMode);
                console.log('   사용 가능: weekly, daily, ipo, all');
        }

        console.log('\n✅ 수동 실행 완료');
        process.exit(0);
    }

    // 개발 모드 체크
    const isDev = args.includes('--dev');
    if (isDev) {
        console.log('\n🔧 개발 모드: 즉시 테스트 실행...');
        await runDailyIssue(); // 빠른 테스트용
        process.exit(0);
    }

    // 스케줄러 모드 (기본)
    setupScheduler();

    // 프로세스 종료 시 메시지
    process.on('SIGINT', () => {
        console.log('\n\n👋 대박이 재무부장, 퇴근합니다! 다음에 또 뵙겠습니다, 대표님! 🫡');
        process.exit(0);
    });
}

main().catch(console.error);
