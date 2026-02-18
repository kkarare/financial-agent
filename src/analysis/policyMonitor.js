// ============================================
// 정부 정책 모니터링 모듈
// 대통령실/부처 유튜브 자막에서 자산 영향 정책을 찾습니다 🏛️
// ============================================
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config');

class PolicyMonitor {
    constructor() {
        this.genAI = null;
    }

    initAI() {
        if (!this.genAI && config.geminiApiKey) {
            this.genAI = new GoogleGenerativeAI(config.geminiApiKey);
        }
    }

    // YouTube Data API로 채널의 최신 영상 목록 수집
    async getRecentVideos(channelId, maxResults = 5) {
        if (!config.youtubeApiKey) {
            console.warn('⚠️ YouTube API Key가 없어 정책 모니터링을 건너뜁니다.');
            return [];
        }

        try {
            const url = `https://www.googleapis.com/youtube/v3/search?key=${config.youtubeApiKey}&channelId=${channelId}&part=snippet&order=date&maxResults=${maxResults}&type=video`;

            const response = await axios.get(url);
            const items = response.data.items || [];

            return items.map(item => ({
                videoId: item.id.videoId,
                title: item.snippet.title,
                publishedAt: item.snippet.publishedAt,
                description: item.snippet.description,
            }));
        } catch (error) {
            console.error(`❌ 유튜브 영상 목록 수집 실패 (${channelId}):`, error.message);
            return [];
        }
    }

    // 유튜브 자막 추출 (무료 API 활용)
    async getTranscript(videoId) {
        try {
            // YouTube 자막 추출 (비공식 API)
            const url = `https://www.youtube.com/watch?v=${videoId}`;
            const response = await axios.get(url, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
            });

            // 자막 트랙 URL 추출
            const captionMatch = response.data.match(/"captionTracks":\[(.*?)\]/);
            if (!captionMatch) return null;

            const captionData = JSON.parse(`[${captionMatch[1]}]`);
            const koreanCaption = captionData.find(c => c.languageCode === 'ko') || captionData[0];

            if (!koreanCaption?.baseUrl) return null;

            // 자막 텍스트 가져오기
            const captionResponse = await axios.get(koreanCaption.baseUrl);
            const cheerio = require('cheerio');
            const $ = cheerio.load(captionResponse.data, { xmlMode: true });

            const texts = [];
            $('text').each((_, el) => {
                texts.push($(el).text());
            });

            return texts.join(' ');
        } catch (error) {
            // 자막이 없는 영상도 많으므로 경고만
            return null;
        }
    }

    // 모든 정부 채널의 최신 영상 분석
    async analyze(portfolio) {
        this.initAI();
        console.log('🏛️ 정부 정책 모니터링 시작...');

        const videoData = [];

        for (const channel of config.govChannels) {
            const videos = await this.getRecentVideos(channel.channelId, 3);

            for (const video of videos) {
                // 최근 7일 이내 영상만 분석
                const publishDate = new Date(video.publishedAt);
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);

                if (publishDate < weekAgo) continue;

                const transcript = await this.getTranscript(video.videoId);
                videoData.push({
                    channel: channel.name,
                    title: video.title,
                    date: video.publishedAt,
                    transcript: transcript || video.description,
                    videoId: video.videoId,
                });

                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        if (videoData.length === 0) {
            return { highlights: [], summary: '최근 7일 이내 분석 대상 영상 없음' };
        }

        // Gemini AI로 자산 영향 정책 분석
        if (!this.genAI) {
            return { highlights: [], summary: 'AI 분석 비활성화' };
        }

        try {
            const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

            const portfolioNames = portfolio.map(p => p.name).join(', ');
            const videoTexts = videoData.map(v =>
                `[${v.channel}] ${v.title}\n${(v.transcript || '').substring(0, 1000)}`
            ).join('\n---\n');

            const prompt = `당신은 금융/경제 정책 분석 전문가입니다.

아래는 대한민국 정부 공식 유튜브 채널의 최신 영상 자막입니다.

**투자자의 보유 종목:** ${portfolioNames}

**정부 영상 자막:**
${videoTexts}

다음을 분석해 주세요:
1. 보유 종목에 영향을 미칠 수 있는 정책 발언/발표를 모두 추출
2. 각 정책이 어떤 종목에 어떤 영향(긍정/부정)을 미칠 수 있는지 분석
3. 투자자가 주의해야 할 핵심 포인트

JSON 형식으로 응답:
{
  "highlights": [
    {
      "channel": "채널명",
      "policy": "정책 내용 요약",
      "affectedStocks": ["영향 종목"],
      "impact": "긍정/부정/중립",
      "detail": "상세 설명"
    }
  ],
  "summary": "전체 요약 (2-3줄)"
}`;

            const result = await model.generateContent(prompt);
            const text = result.response.text();
            const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            return JSON.parse(jsonStr);
        } catch (error) {
            console.error('❌ 정책 분석 실패:', error.message);
            return { highlights: [], summary: '분석 실패' };
        }
    }
}

module.exports = new PolicyMonitor();
