// ============================================
// 공모주 투자 수익 추적 모듈
// 월간/연간 수익을 집계하고 등급별 적중률을 분석합니다 💹
// ============================================
const sheetsReader = require('../sheets/reader');
const sheetsWriter = require('../sheets/writer');

class IpoProfitTracker {
    // 수익 현황 집계
    async generateProfitSummary() {
        console.log('💹 공모주 수익 현황 집계 중...');

        const records = await sheetsReader.getIpoRecords();

        if (records.length === 0) {
            return { monthly: [], yearly: [], gradeStats: {}, totalSummary: null };
        }

        // 완료된 거래만 필터 (판매가가 있는 것)
        const completed = records.filter(r => r.sellPrice > 0);
        const pending = records.filter(r => !r.sellPrice || r.sellPrice === 0);

        // === 월간 집계 ===
        const monthlyMap = {};
        for (const rec of completed) {
            const yearMonth = rec.sellDate ? rec.sellDate.substring(0, 7) : '미정';
            if (!monthlyMap[yearMonth]) {
                monthlyMap[yearMonth] = { invested: 0, profit: 0, count: 0 };
            }
            const invested = rec.ipoPrice * rec.allocated;
            const profit = (rec.sellPrice - rec.ipoPrice) * rec.allocated;
            monthlyMap[yearMonth].invested += invested;
            monthlyMap[yearMonth].profit += profit;
            monthlyMap[yearMonth].count += 1;
        }

        const monthly = Object.entries(monthlyMap)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([yearMonth, data]) => ({
                yearMonth,
                invested: data.invested,
                profit: data.profit,
                returnRate: data.invested > 0 ? ((data.profit / data.invested) * 100).toFixed(2) : '0',
                count: data.count,
            }));

        // === 연간 집계 ===
        const yearlyMap = {};
        for (const m of monthly) {
            const year = m.yearMonth.substring(0, 4);
            if (!yearlyMap[year]) {
                yearlyMap[year] = { invested: 0, profit: 0, count: 0 };
            }
            yearlyMap[year].invested += m.invested;
            yearlyMap[year].profit += m.profit;
            yearlyMap[year].count += m.count;
        }

        const yearly = Object.entries(yearlyMap)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([year, data]) => ({
                year,
                invested: data.invested,
                profit: data.profit,
                returnRate: data.invested > 0 ? ((data.profit / data.invested) * 100).toFixed(2) : '0',
                count: data.count,
            }));

        // === 등급별 적중률 통계 ===
        const gradeMap = {};
        for (const rec of completed) {
            const grade = rec.grade || '미정';
            if (!gradeMap[grade]) {
                gradeMap[grade] = { count: 0, totalReturn: 0, wins: 0 };
            }
            const returnRate = rec.ipoPrice > 0
                ? ((rec.sellPrice - rec.ipoPrice) / rec.ipoPrice) * 100
                : 0;
            gradeMap[grade].count += 1;
            gradeMap[grade].totalReturn += returnRate;
            if (returnRate > 0) gradeMap[grade].wins += 1;
        }

        const gradeStats = {};
        for (const [grade, data] of Object.entries(gradeMap)) {
            gradeStats[grade] = {
                count: data.count,
                avgReturn: (data.totalReturn / data.count).toFixed(2),
                winRate: ((data.wins / data.count) * 100).toFixed(1),
            };
        }

        // === 전체 총합 ===
        const totalInvested = completed.reduce((s, r) => s + r.ipoPrice * r.allocated, 0);
        const totalProfit = completed.reduce((s, r) => s + (r.sellPrice - r.ipoPrice) * r.allocated, 0);

        const totalSummary = {
            totalTrades: completed.length,
            pendingTrades: pending.length,
            totalInvested,
            totalProfit,
            totalReturnRate: totalInvested > 0 ? ((totalProfit / totalInvested) * 100).toFixed(2) : '0',
        };

        // 스프레드시트 업데이트
        try {
            await sheetsWriter.updateMonthlyProfit(records);
        } catch (e) {
            console.warn('⚠️ 월간 수익 시트 업데이트 건너뜀');
        }

        console.log(`✅ 수익 집계 완료: ${completed.length}건 거래, 총 수익률 ${totalSummary.totalReturnRate}%`);

        return { monthly, yearly, gradeStats, totalSummary };
    }

    // 수익 리포트 텍스트 생성
    formatReport(summary) {
        const lines = [];

        lines.push('# 💹 공모주 투자 수익 리포트\n');

        // 전체 요약
        if (summary.totalSummary) {
            const ts = summary.totalSummary;
            lines.push('## 📊 전체 현황');
            lines.push(`- 완료 거래: **${ts.totalTrades}건** | 진행 중: ${ts.pendingTrades}건`);
            lines.push(`- 총 투자금: **${ts.totalInvested.toLocaleString()}원**`);
            lines.push(`- 총 수익금: **${ts.totalProfit.toLocaleString()}원** (${ts.totalReturnRate}%)\n`);
        }

        // 월간 수익
        if (summary.monthly.length > 0) {
            lines.push('## 📅 월간 수익');
            lines.push('| 년월 | 투자금 | 수익금 | 수익률 | 건수 |');
            lines.push('|------|--------|--------|--------|------|');
            for (const m of summary.monthly) {
                lines.push(`| ${m.yearMonth} | ${m.invested.toLocaleString()} | ${m.profit.toLocaleString()} | ${m.returnRate}% | ${m.count} |`);
            }
            lines.push('');
        }

        // 연간 수익
        if (summary.yearly.length > 0) {
            lines.push('## 📆 연간 수익');
            lines.push('| 년도 | 투자금 | 수익금 | 수익률 | 건수 |');
            lines.push('|------|--------|--------|--------|------|');
            for (const y of summary.yearly) {
                lines.push(`| ${y.year} | ${y.invested.toLocaleString()} | ${y.profit.toLocaleString()} | ${y.returnRate}% | ${y.count} |`);
            }
            lines.push('');
        }

        // 등급별 통계
        if (Object.keys(summary.gradeStats).length > 0) {
            lines.push('## 🏆 등급별 적중률');
            lines.push('| 등급 | 거래수 | 평균수익률 | 승률 |');
            lines.push('|------|--------|------------|------|');
            const gradeOrder = ['S', 'A+', 'A', 'B+', 'B', 'C', 'D', 'E'];
            for (const grade of gradeOrder) {
                if (summary.gradeStats[grade]) {
                    const gs = summary.gradeStats[grade];
                    lines.push(`| ${grade} | ${gs.count} | ${gs.avgReturn}% | ${gs.winRate}% |`);
                }
            }
        }

        return lines.join('\n');
    }
}

module.exports = new IpoProfitTracker();
