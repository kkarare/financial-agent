// ============================================
// Gmail SMTP 이메일 발송 모듈
// 대표님께 매일 아침 리포트를 배달합니다 📧
// ============================================
const nodemailer = require('nodemailer');
const config = require('../config');

class EmailSender {
    constructor() {
        this.transporter = null;
    }

    // SMTP 트랜스포터 초기화
    init() {
        if (this.transporter) return;

        this.transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: config.gmail.user,
                pass: config.gmail.appPassword,
            },
        });
    }

    // 이메일 발송
    async send({ subject, html, text }) {
        this.init();

        try {
            const mailOptions = {
                from: `"🐟 대박이 재무부장" <${config.gmail.user}>`,
                to: config.gmail.recipient,
                subject,
                html: html || undefined,
                text: text || undefined,
            };

            const info = await this.transporter.sendMail(mailOptions);
            console.log(`📧 이메일 발송 완료: ${subject} (${info.messageId})`);
            return true;
        } catch (error) {
            console.error('❌ 이메일 발송 실패:', error.message);
            return false;
        }
    }

    // 주간 리포트 발송
    async sendWeeklyReport(reportContent) {
        const today = new Date().toLocaleDateString('ko-KR');
        return this.send({
            subject: `📊 [주간 투자 리포트] ${today} - 대박이 재무부장`,
            html: this._wrapHtml('주간 투자 리포트', reportContent),
        });
    }

    // 일간 이슈 발송
    async sendDailyIssue(issueContent) {
        const today = new Date().toLocaleDateString('ko-KR');
        return this.send({
            subject: `☀️ [일간 투자 브리핑] ${today} - 대박이 재무부장`,
            html: this._wrapHtml('일간 투자 브리핑', issueContent),
        });
    }

    // 공모주 알림 발송
    async sendIpoAlert(ipoContent) {
        return this.send({
            subject: `🆕 [공모주 분석] 신규 공모주 알림 - 대박이 재무부장`,
            html: this._wrapHtml('공모주 분석 리포트', ipoContent),
        });
    }

    // HTML 래퍼
    _wrapHtml(title, markdownContent) {
        // 마크다운을 간단한 HTML로 변환
        let html = markdownContent
            .replace(/^### (.*$)/gm, '<h3 style="color:#1a237e;margin-top:20px;">$1</h3>')
            .replace(/^## (.*$)/gm, '<h2 style="color:#0d47a1;border-bottom:2px solid #e3f2fd;padding-bottom:8px;margin-top:24px;">$1</h2>')
            .replace(/^# (.*$)/gm, '<h1 style="color:#1565c0;">$1</h1>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/^- (.*$)/gm, '<li style="margin:4px 0;">$1</li>')
            .replace(/(<li.*<\/li>\n?)+/g, '<ul style="padding-left:20px;">$&</ul>')
            .replace(/\n\n/g, '<br><br>')
            .replace(/\n/g, '<br>')
            // 테이블 변환
            .replace(/\|(.+)\|/g, (match) => {
                const cells = match.split('|').filter(c => c.trim());
                if (cells.every(c => c.trim().match(/^[-:]+$/))) return ''; // 구분선 제거
                const isHeader = match.includes('---');
                const tag = isHeader ? 'th' : 'td';
                const style = isHeader
                    ? 'style="background:#1565c0;color:white;padding:8px 12px;text-align:left;"'
                    : 'style="padding:8px 12px;border-bottom:1px solid #e0e0e0;"';
                const htmlCells = cells.map(c => `<${tag} ${style}>${c.trim()}</${tag}>`).join('');
                return `<tr>${htmlCells}</tr>`;
            });

        return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family:'Noto Sans KR',sans-serif;max-width:700px;margin:0 auto;padding:20px;background:#f5f5f5;">
  <div style="background:linear-gradient(135deg,#1565c0,#0d47a1);color:white;padding:24px;border-radius:12px 12px 0 0;text-align:center;">
    <h1 style="margin:0;font-size:24px;">🐟 대박이 재무부장</h1>
    <p style="margin:8px 0 0;opacity:0.9;font-size:14px;">${title} | ${new Date().toLocaleDateString('ko-KR')}</p>
  </div>
  <div style="background:white;padding:24px;border-radius:0 0 12px 12px;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
    ${html}
  </div>
  <div style="text-align:center;padding:16px;color:#9e9e9e;font-size:12px;">
    <p>이 메일은 대박이 재무 분석 AI 에이전트가 자동 발송한 리포트입니다.</p>
    <p>충성! 대표님의 성공적인 투자를 기원합니다! 🫡🚀</p>
  </div>
</body>
</html>`;
    }
}

module.exports = new EmailSender();
