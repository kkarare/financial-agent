// 공모주 수집 테스트 (깔끔한 출력)
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const collector = require('../src/ipo/ipoCollector');

(async () => {
    console.log('=== IPO Collector Test ===');
    const list = await collector.getIpoSchedule();
    console.log('Result count:', list.length);
    if (list.length > 0) {
        for (const item of list.slice(0, 5)) {
            console.log(`- ${item.name} | Price: ${item.ipoPrice} | Date: ${item.subscriptionDate}`);
        }
    } else {
        console.log('No IPOs found (normal if no active IPOs currently)');
    }
    console.log('=== Test Complete ===');
})().catch(e => console.error('Error:', e.message));
