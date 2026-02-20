const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');
const crypto = require('crypto');
const config = require('../config');

// 38커뮤니케이션 SSL 호환용 HTTPS Agent
// Node.js v24+ 에서 dh key too small 오류 우회
let legacyAgent;
try {
    legacyAgent = new https.Agent({
        secureOptions: crypto.constants?.SSL_OP_LEGACY_SERVER_CONNECT || 0,
        ciphers: 'DEFAULT:@SECLEVEL=0',
    });
} catch {
    legacyAgent = new https.Agent({ rejectUnauthorized: false });
}

class IpoCollector {
    // 38커뮤니케이션에서 공모주 일정 수집
    async getIpoSchedule() {
        console.log('📋 38커뮤니케이션 공모주 일정 수집 중...');

        try {
            const url = 'https://www.38.co.kr/html/fund/index.htm?o=k';
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                },
                responseType: 'arraybuffer',
                httpsAgent: legacyAgent,
                timeout: 15000,
            });

            // EUC-KR → UTF-8 변환
            const iconv = require('iconv-lite');
            let html;
            try {
                html = iconv.decode(Buffer.from(response.data), 'euc-kr');
            } catch {
                html = response.data.toString('utf-8');
            }

            const $ = cheerio.load(html);
            const ipoList = [];

            // 날짜 패턴: XX.XX~XX.XX 또는 XXXX.XX.XX 형태
            const datePattern = /\d{2,4}[\.\-\/]\d{2}[\.\-\/]?\d{0,2}/;

            // 공모주 테이블 파싱 (날짜 패턴이 있는 행만 선별)
            $('table tr').each((idx, row) => {
                const tds = $(row).find('td');
                if (tds.length < 5) return;

                // 모든 셀 텍스트 확인
                const cellTexts = [];
                tds.each((_, td) => cellTexts.push($(td).text().trim()));

                // 날짜가 포함된 셀이 있는지 확인 (청약일 또는 상장일)
                const hasDate = cellTexts.some(t => datePattern.test(t));
                if (!hasDate) return;

                // 종목명: 첫 번째 셀에서 링크 텍스트 우선
                const nameLink = $(tds[0]).find('a');
                const name = nameLink.length > 0
                    ? nameLink.first().text().trim()
                    : cellTexts[0];

                // 유효한 종목명 검증 (최소 2자, 메뉴 텍스트 아닌 것)
                if (!name || name.length < 2 || name.length > 30) return;
                if (name.includes('Copyright') || name.includes('38커뮤') || name.includes('검색')) return;
                if (name.includes('비상장') || name.includes('장외') || name.includes('시세')) return;

                const ipo = {
                    name,
                    category: cellTexts[1] || '',
                    ipoPrice: cellTexts[2] || '',
                    priceRange: cellTexts[3] || '',
                    subscriptionDate: cellTexts[4] || '',
                    listingDate: cellTexts.length > 5 ? cellTexts[5] : '',
                    competitionRate: cellTexts.length > 6 ? cellTexts[6] : '',
                };

                ipoList.push(ipo);
            });

            // 중복 제거
            const uniqueIpos = ipoList.filter((ipo, idx, self) =>
                idx === self.findIndex(i => i.name === ipo.name)
            );

            console.log(`✅ ${uniqueIpos.length}개 공모주 일정 수집 완료`);
            return uniqueIpos;
        } catch (error) {
            console.error('❌ 38커뮤니케이션 크롤링 실패:', error.message);
            // 폴백: DART API로 공모주 청약 일정 수집 시도
            console.log('📋 DART API로 폴백 수집 시도...');
            return await this._getDartIpoSchedule();
        }
    }

    // 38커뮤니케이션에서 공모주 상세 정보 수집
    async getIpoDetail(name) {
        try {
            const searchUrl = `https://www.38.co.kr/html/fund/index.htm?o=k&name=${encodeURIComponent(name)}`;
            const response = await axios.get(searchUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                responseType: 'arraybuffer',
            });

            const iconv = require('iconv-lite');
            let html;
            try {
                html = iconv.decode(Buffer.from(response.data), 'euc-kr');
            } catch {
                html = response.data.toString('utf-8');
            }

            const $ = cheerio.load(html);

            // 상세 정보 추출 (기관경쟁률, 확약비율 등)
            const detail = {
                name,
                institutionalCompetition: '',  // 기관경쟁률
                lockupRatio: '',               // 의무보유확약 비율
                underwriter: '',               // 주간사
                totalShares: '',               // 총공모주식수
                publicOffering: '',            // 공모금액
            };

            // 테이블에서 상세 데이터 파싱
            $('table tr').each((_, row) => {
                const th = $(row).find('th, td').first().text().trim();
                const td = $(row).find('td').last().text().trim();

                if (th.includes('기관경쟁률')) detail.institutionalCompetition = td;
                if (th.includes('확약비율') || th.includes('의무보유')) detail.lockupRatio = td;
                if (th.includes('주간사') || th.includes('대표주관')) detail.underwriter = td;
                if (th.includes('공모주식수')) detail.totalShares = td;
                if (th.includes('공모금액')) detail.publicOffering = td;
            });

            return detail;
        } catch (error) {
            console.error(`❌ 공모주 상세 정보 수집 실패 (${name}):`, error.message);
            return null;
        }
    }

    // DART API로 공모주 공시자료 조회
    async getDartDisclosure(companyName) {
        if (!config.dartApiKey) {
            console.warn('⚠️ DART API Key가 없어 공시 조회를 건너뜁니다.');
            return null;
        }

        try {
            // 1. 회사명으로 고유번호 검색
            const searchUrl = `https://opendart.fss.or.kr/api/company.json?crtfc_key=${config.dartApiKey}&corp_name=${encodeURIComponent(companyName)}`;
            const searchResp = await axios.get(searchUrl);

            if (searchResp.data.status !== '000') return null;

            const corpCode = searchResp.data.corp_code;

            // 2. 해당 기업의 최근 공시 목록 조회
            const disclosureUrl = `https://opendart.fss.or.kr/api/list.json?crtfc_key=${config.dartApiKey}&corp_code=${corpCode}&bgn_de=${this._getDateStr(-90)}&end_de=${this._getDateStr(0)}&pblntf_ty=I&page_count=10`;
            const discResp = await axios.get(disclosureUrl);

            if (discResp.data.status !== '000') return null;

            const disclosures = discResp.data.list || [];

            // 증권신고서, 투자설명서 필터링
            const relevant = disclosures.filter(d =>
                d.report_nm.includes('증권신고서') ||
                d.report_nm.includes('투자설명서') ||
                d.report_nm.includes('증권발행실적')
            );

            return {
                corpCode,
                companyName,
                disclosures: relevant.map(d => ({
                    title: d.report_nm,
                    date: d.rcept_dt,
                    rceptNo: d.rcept_no,
                })),
            };
        } catch (error) {
            console.error(`❌ DART 공시 조회 실패 (${companyName}):`, error.message);
            return null;
        }
    }

    // 날짜 문자열 유틸리티
    _getDateStr(daysOffset) {
        const date = new Date();
        date.setDate(date.getDate() + daysOffset);
        return date.toISOString().split('T')[0].replace(/-/g, '');
    }

    // DART API 폴백: 공모주 청약 일정 수집
    async _getDartIpoSchedule() {
        if (!config.dartApiKey) return [];

        try {
            const bgn = this._getDateStr(-30);
            const end = this._getDateStr(30);
            const url = `https://opendart.fss.or.kr/api/list.json?crtfc_key=${config.dartApiKey}&bgn_de=${bgn}&end_de=${end}&pblntf_ty=I&page_count=30`;
            const resp = await axios.get(url);

            if (resp.data.status !== '000' || !resp.data.list) return [];

            const ipoRelated = resp.data.list.filter(d =>
                d.report_nm.includes('증권신고서') || d.report_nm.includes('투자설명서')
            );

            return ipoRelated.map(d => ({
                name: d.corp_name,
                category: '',
                ipoPrice: '확인 필요',
                priceRange: '',
                subscriptionDate: d.rcept_dt,
                listingDate: '',
                competitionRate: '',
                source: 'DART',
            }));
        } catch (error) {
            console.error('❌ DART 폴백도 실패:', error.message);
            return [];
        }
    }

    // 신규 공모주 감지 (이전 목록과 비교)
    async detectNewIpos(previousList = []) {
        const currentList = await this.getIpoSchedule();
        const previousNames = new Set(previousList.map(i => i.name));
        const newIpos = currentList.filter(i => !previousNames.has(i.name));

        if (newIpos.length > 0) {
            console.log(`🆕 신규 공모주 ${newIpos.length}개 감지!`);
        }

        return { current: currentList, newIpos };
    }

    // ============================================
    // 청약일 파싱 유틸리티
    // '02.20~02.21' 또는 '26.02.20~02.21' 등 다양한 형태 처리
    // ============================================
    parseDateRange(dateStr) {
        if (!dateStr) return null;

        try {
            // '02.20~02.21' → 시작일 '02.20' 추출
            const startPart = dateStr.split('~')[0].trim();

            // 년도 포함 여부 확인 (예: '2026.02.20')
            const parts = startPart.split('.');
            let month, day, year;

            if (parts.length === 3) {
                // YYYY.MM.DD 형태
                year = parseInt(parts[0]);
                month = parseInt(parts[1]);
                day = parseInt(parts[2]);
            } else if (parts.length === 2) {
                // MM.DD 형태 (연도 없음 → 현재 연도 기준)
                const now = new Date();
                year = now.getFullYear();
                month = parseInt(parts[0]);
                day = parseInt(parts[1]);

                // 월이 현재 월보다 작으면 내년으로 보정
                // (예: 현재 12월인데 01.05이면 내년 1월)
                if (month < now.getMonth() + 1) {
                    year += 1;
                }
            } else {
                return null;
            }

            if (isNaN(year) || isNaN(month) || isNaN(day)) return null;

            // YYYY-MM-DD 형태로 반환 (시간 없는 Date)
            return new Date(year, month - 1, day);
        } catch {
            return null;
        }
    }

    // ============================================
    // 내일 청약 시작 종목만 필터링
    // 스케줄러에서 매일 18:00 호출 시 사용
    // ============================================
    filterTomorrowSubscription(ipoList) {
        // KST 기준 '내일' 날짜 계산
        const nowKST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
        const tomorrow = new Date(nowKST);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const tYear = tomorrow.getFullYear();
        const tMonth = tomorrow.getMonth() + 1;
        const tDay = tomorrow.getDate();

        console.log(`🔍 필터 기준: 내일 KST ${tYear}-${String(tMonth).padStart(2, '0')}-${String(tDay).padStart(2, '0')} 청약 시작 종목`);

        const filtered = ipoList.filter(ipo => {
            const startDate = this.parseDateRange(ipo.subscriptionDate);
            if (!startDate) return false;

            return (
                startDate.getFullYear() === tYear &&
                startDate.getMonth() + 1 === tMonth &&
                startDate.getDate() === tDay
            );
        });

        console.log(`📌 내일 청약 시작 종목: ${filtered.length}개`);
        return filtered;
    }
}

module.exports = new IpoCollector();
