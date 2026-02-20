// ============================================
// 공모주 날짜 파싱 & 필터링 단위 테스트
// '내일 청약 시작' 로직 검증
// ============================================

// ipoCollector의 parseDateRange / filterTomorrowSubscription 로직 인라인 복사 (require 없이 빠른 테스트)
function parseDateRange(dateStr) {
    if (!dateStr) return null;
    try {
        const startPart = dateStr.split('~')[0].trim();
        const parts = startPart.split('.');
        let month, day, year;
        if (parts.length === 3) {
            year = parseInt(parts[0]);
            month = parseInt(parts[1]);
            day = parseInt(parts[2]);
        } else if (parts.length === 2) {
            const now = new Date();
            year = now.getFullYear();
            month = parseInt(parts[0]);
            day = parseInt(parts[1]);
            if (month < now.getMonth() + 1) year += 1;
        } else {
            return null;
        }
        if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
        return new Date(year, month - 1, day);
    } catch (e) {
        return null;
    }
}

function filterTomorrowSubscription(ipoList) {
    const nowKST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    const tomorrow = new Date(nowKST);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tYear = tomorrow.getFullYear();
    const tMonth = tomorrow.getMonth() + 1;
    const tDay = tomorrow.getDate();

    console.log(`🔍 기준: 내일 KST ${tYear}-${String(tMonth).padStart(2, '0')}-${String(tDay).padStart(2, '0')}`);

    return ipoList.filter(ipo => {
        const d = parseDateRange(ipo.subscriptionDate);
        if (!d) return false;
        return d.getFullYear() === tYear && d.getMonth() + 1 === tMonth && d.getDate() === tDay;
    });
}

// ============================================
// 테스트 케이스 생성
// ============================================
const nowKST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
const tmr = new Date(nowKST);
tmr.setDate(tmr.getDate() + 1);
const mm = String(tmr.getMonth() + 1).padStart(2, '0');
const dd = String(tmr.getDate()).padStart(2, '0');
const dd2 = String(tmr.getDate() + 1).padStart(2, '0');

const tomorrowStr_MM = `${mm}.${dd}~${mm}.${dd2}`;          // MM.DD 형태
const tomorrowStr_YYYY = `${tmr.getFullYear()}.${mm}.${dd}~${mm}.${dd2}`;  // YYYY.MM.DD 형태

console.log('\n=== 공모주 날짜 파싱 & 필터 테스트 ===\n');
console.log('내일 테스트 문자열 (MM.DD형)  :', tomorrowStr_MM);
console.log('내일 테스트 문자열 (YYYY형)   :', tomorrowStr_YYYY);

const mockList = [
    { name: '✅ 내일청약(MM.DD형)', subscriptionDate: tomorrowStr_MM },
    { name: '✅ 내일청약(YYYY.형)', subscriptionDate: tomorrowStr_YYYY },
    { name: '❌ 과거종목', subscriptionDate: '01.01~01.02' },
    { name: '❌ 날짜없음', subscriptionDate: '' },
    { name: '❌ 잘못된형식', subscriptionDate: 'abc~def' },
];

const result = filterTomorrowSubscription(mockList);
console.log('\n필터 결과:', result.map(i => i.name));

// 검증
let passed = true;
if (result.length !== 2) {
    console.log(`❌ 실패: 기대값 2개, 실제 ${result.length}개`);
    passed = false;
}
if (passed) console.log('\n✅ 모든 테스트 통과! 대박!');
process.exit(passed ? 0 : 1);
