# 🐟 재무 분석 AI 에이전트 (Financial Analysis Agent)

대박이 개발부장이 개발한 1인 기업가 전용 재무 분석 및 공모주 관리 에이전트입니다.

## 🚀 주요 기능

### 1. 📊 주간/일간 투자 리포트
- **매일 아침 07:00**: 전날의 핵심 뉴스(Noise 제거)와 시장 이슈를 요약하여 이메일 발송
- **매주 월요일 07:00**: 보유 종목에 대한 펀더멘털 진단(PER, ROE 기반 적정주가) 및 종합 리포트 발송

### 2. 🆕 공모주 자동 모니터링 & 분석
- **매일 오전 09:00**: 38커뮤니케이션 & DART를 크롤링하여 신규 공모주 감지
- **AI 등급 산출**: 기관경쟁률, 확약비율, 재무제표를 분석하여 **S~E 등급** 부여 및 상장 시 예측 최고가 산출
- **캘린더 연동**: 청약일, 환불일, 상장일 일정을 구글 캘린더에 자동 등록

### 3. 🛡️ 정부 정책 모니터링
- 정부 공식 유튜브 채널의 자막을 분석하여 보유 자산에 영향을 줄 수 있는 정책 변화 감지

## 🛠️ 설치 및 실행

### 필수 요건
- Node.js v20 이상
- Google Cloud API Key (Gemini, YouTube, Sheets, Calendar)
- DART API Key

### 로컬 실행
```bash
# 의존성 설치
npm install

# 서비스 시작 (스케줄러)
npm start

# 수동 실행
npm run daily    # 일간 이슈 리포트
npm run weekly   # 주간 종합 리포트
npm run ipo      # 공모주 모니터링
```

### ☁️ 클라우드 배포 (Railway)
이 프로젝트는 [Railway](https://railway.app) 배포에 최적화되어 있습니다.
1. GitHub에 리포지토리 푸시
2. Railway에서 'New Project' -> 'Deploy from GitHub' 선택
3. 환경변수(.env 내용) 설정
4. 배포 완료!

## 📁 프로젝트 구조
- `src/index.js`: 메인 스케줄러
- `src/analysis/`: AI 분석 엔진 (펀더멘털, 리포트, 정책)
- `src/market/`: 데이터 수집 (주가, 뉴스)
- `src/ipo/`: 공모주 분석 및 관리
- `src/email/`: 이메일 발송 모듈
- `src/sheets/`: 구글 스프레드시트 연동

**충성! 대표님의 성공 투자를 기원합니다!** 🫡
