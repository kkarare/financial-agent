// ============================================
// 환경변수 설정 모듈
// 대박이 개발부장이 정성스럽게 구성했습니다 🫡
// ============================================
require('dotenv').config();

const config = {
  // Gemini AI
  geminiApiKey: process.env.GEMINI_API_KEY,

  // Gmail SMTP
  gmail: {
    user: process.env.GMAIL_USER || 'kkarere@gmail.com',
    appPassword: process.env.GMAIL_APP_PASSWORD,
    recipient: process.env.RECIPIENT_EMAIL || 'kkarere@gmail.com',
  },

  // Google Spreadsheet
  spreadsheetId: process.env.SPREADSHEET_ID || '1c5Q1fTJbc5WcaLCA1aqm1QNbb6CZlaWxXpfJqXQDvqU',

  // Google Cloud 서비스 계정
  google: {
    serviceAccountPath: process.env.GOOGLE_SERVICE_ACCOUNT_PATH || './credentials/service-account.json',
    calendarId: process.env.GOOGLE_CALENDAR_ID,
  },

  // DART API
  dartApiKey: process.env.DART_API_KEY,

  // YouTube Data API
  youtubeApiKey: process.env.YOUTUBE_API_KEY,

  // 시트 이름 상수
  sheets: {
    portfolio: '포트폴리오_현황',
    weeklyIssue: '주간_시장_이슈',
    ipoRecord: '공모주_투자기록',
    ipoMonthly: '공모주_월간수익',
  },

  // 정부 유튜브 채널 ID 목록
  govChannels: [
    { name: '대통령실', channelId: 'UCgewMSNEBNaJMgOcfp1yyXw' },
    { name: '기획재정부', channelId: 'UCpGmAXbEXkxQL7C6lQMIk5Q' },
    { name: '금융위원회', channelId: 'UCisPSiOmfhGNPAR1hKvpRaA' },
    { name: '산업통상자원부', channelId: 'UCtMlGy3o5nMipxLnWDGmabQ' },
  ],
};

// 필수 환경변수 체크 함수
config.validate = function () {
  const missing = [];
  if (!this.geminiApiKey) missing.push('GEMINI_API_KEY');
  if (!this.gmail.appPassword) missing.push('GMAIL_APP_PASSWORD');
  if (missing.length > 0) {
    console.warn(`⚠️ [설정 경고] 다음 환경변수가 누락되었습니다: ${missing.join(', ')}`);
    console.warn('   .env 파일을 확인해 주세요.');
    return false;
  }
  return true;
};

module.exports = config;
