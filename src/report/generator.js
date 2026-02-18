// ============================================
// 리포트 생성기 모듈
// 분석 결과를 아름다운 리포트로 변환합니다 📄
// ============================================

class ReportGenerator {
    // 주간 종합 리포트 HTML 생성
    generateWeeklyHtml(analysisResult, newsResult, policyResult, weeklyReport) {
        const stocks = analysisResult?.stocks || [];

        // 종목 진단 테이블
        let stockTable = '';
        for (const s of stocks) {
            const returnColor = parseFloat(s.returnRate) >= 0 ? '#c62828' : '#1565c0';
            const gapColor = s.gap < -20 ? '#00c853' : s.gap > 20 ? '#d50000' : '#757575';

            stockTable += `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">${s.name}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${s.currentPrice?.toLocaleString?.() || '-'}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${s.fairValue?.avgFairValue?.toLocaleString?.() || '-'}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;color:${gapColor};">${s.gap ?? '-'}%</td>
        <td style="padding:8px;border-bottom:1px solid #eee;">${s.opinion || '-'}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;color:${returnColor};">${s.returnRate || '-'}%</td>
      </tr>`;
        }

        return `
    <h2 style="color:#1565c0;">📊 보유 종목 진단</h2>
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead>
        <tr style="background:#e3f2fd;">
          <th style="padding:10px;text-align:left;">종목</th>
          <th style="padding:10px;text-align:right;">현재가</th>
          <th style="padding:10px;text-align:right;">적정가</th>
          <th style="padding:10px;text-align:right;">괴리율</th>
          <th style="padding:10px;">의견</th>
          <th style="padding:10px;text-align:right;">수익률</th>
        </tr>
      </thead>
      <tbody>${stockTable}</tbody>
    </table>

    <div style="background:#f8f9fa;padding:16px;border-radius:8px;margin:20px 0;">
      <h3 style="margin-top:0;">🧠 AI 종합 코멘트</h3>
      <p style="line-height:1.6;">${analysisResult?.aiComment || '분석 코멘트 없음'}</p>
    </div>

    ${weeklyReport?.content ? `<div style="margin-top:20px;">${weeklyReport.content}</div>` : ''}
    `;
    }

    // 공모주 분석 리포트 HTML 생성
    generateIpoHtml(ipoAnalyses) {
        if (!ipoAnalyses || ipoAnalyses.length === 0) {
            return '<p>분석 대상 공모주가 없습니다.</p>';
        }

        let html = '<h2 style="color:#1565c0;">🆕 공모주 분석 리포트</h2>';

        for (const ipo of ipoAnalyses) {
            const analysis = ipo.analysis || {};
            const gradeInfo = analysis.gradeInfo || {};
            const gradeColor = gradeInfo.color || '#9e9e9e';

            html += `
      <div style="border:2px solid ${gradeColor};border-radius:12px;padding:20px;margin:16px 0;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <h3 style="margin:0;color:#1a237e;">${ipo.name}</h3>
          <div style="background:${gradeColor};color:white;padding:8px 16px;border-radius:20px;font-weight:bold;font-size:18px;">
            ${gradeInfo.icon || ''} ${analysis.grade || '?'}
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0;">
          <div style="background:#f5f5f5;padding:12px;border-radius:8px;">
            <small style="color:#757575;">공모가</small>
            <div style="font-size:18px;font-weight:bold;">${ipo.ipoPrice || '미정'}</div>
          </div>
          <div style="background:#f5f5f5;padding:12px;border-radius:8px;">
            <small style="color:#757575;">예측 최고가</small>
            <div style="font-size:18px;font-weight:bold;">
              ${analysis.predictedHighPrice ? `${analysis.predictedHighPrice.min?.toLocaleString?.() || '?'} ~ ${analysis.predictedHighPrice.max?.toLocaleString?.() || '?'}원` : '미정'}
            </div>
          </div>
          <div style="background:#f5f5f5;padding:12px;border-radius:8px;">
            <small style="color:#757575;">기관경쟁률</small>
            <div style="font-size:18px;font-weight:bold;">${ipo.detail?.institutionalCompetition || '미공개'}</div>
          </div>
          <div style="background:#f5f5f5;padding:12px;border-radius:8px;">
            <small style="color:#757575;">예상 수익률</small>
            <div style="font-size:18px;font-weight:bold;color:${gradeColor};">${gradeInfo.expectedReturn || '미정'}</div>
          </div>
        </div>

        <div style="margin:12px 0;">
          <strong>등급 근거:</strong> ${analysis.gradeReason || '-'}
        </div>

        ${analysis.keyPoints?.length > 0 ? `
        <div style="margin:12px 0;">
          <strong>📋 핵심 포인트:</strong>
          <ul style="margin:8px 0;">
            ${analysis.keyPoints.map(p => `<li>${p}</li>`).join('')}
          </ul>
        </div>` : ''}

        <div style="background:#e3f2fd;padding:12px;border-radius:8px;margin-top:12px;">
          <strong>💡 추천:</strong> ${analysis.recommendation || '-'}
        </div>
      </div>`;
        }

        return html;
    }
}

module.exports = new ReportGenerator();
