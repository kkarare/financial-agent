// ============================================
// 전체 API 키 검증 스크립트
// ============================================
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const fs = require('fs');

async function verifyAll() {
    console.log('========================================');
    console.log(' API KEY VERIFICATION');
    console.log('========================================\n');

    let passed = 0;
    let failed = 0;
    let warnings = 0;

    // 1. Gemini API Key
    console.log('[1] Gemini API Key...');
    try {
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const result = await model.generateContent('Say hello in Korean, one word only.');
        const text = result.response.text().trim();
        console.log('  -> OK! Response:', text);
        passed++;
    } catch (e) {
        console.log('  -> FAIL:', e.message.substring(0, 100));
        failed++;
    }

    // 2. DART API Key
    console.log('\n[2] DART API Key...');
    try {
        const axios = require('axios');
        const url = `https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=${process.env.DART_API_KEY}`;
        const resp = await axios.get(url, { timeout: 10000, validateStatus: () => true });
        if (resp.status === 200) {
            console.log('  -> OK! DART API connected (status 200)');
            passed++;
        } else {
            console.log('  -> FAIL: status', resp.status);
            failed++;
        }
    } catch (e) {
        console.log('  -> FAIL:', e.message.substring(0, 100));
        failed++;
    }

    // 3. YouTube API Key
    console.log('\n[3] YouTube API Key...');
    try {
        const axios = require('axios');
        const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=test&maxResults=1&key=${process.env.YOUTUBE_API_KEY}`;
        const resp = await axios.get(url, { timeout: 10000 });
        if (resp.data.items) {
            console.log('  -> OK! YouTube API connected, found', resp.data.items.length, 'result(s)');
            passed++;
        }
    } catch (e) {
        const msg = e.response?.data?.error?.message || e.message;
        console.log('  -> FAIL:', msg.substring(0, 100));
        failed++;
    }

    // 4. Gmail SMTP
    console.log('\n[4] Gmail SMTP (App Password)...');
    try {
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.GMAIL_USER,
                pass: process.env.GMAIL_APP_PASSWORD,
            },
        });
        await transporter.verify();
        console.log('  -> OK! Gmail SMTP connected successfully');
        passed++;
    } catch (e) {
        console.log('  -> FAIL:', e.message.substring(0, 100));
        console.log('  -> NOTE: Gmail App Password required (not regular password)');
        failed++;
    }

    // 5. Google Calendar ID
    console.log('\n[5] Google Calendar ID...');
    const calId = process.env.GOOGLE_CALENDAR_ID;
    if (calId && calId !== '' && !calId.includes('here')) {
        console.log('  -> SET:', calId);
        if (calId !== process.env.GMAIL_USER) {
            console.log('  -> WARNING: Calendar ID differs from Gmail. Typo check: "kkarare" vs "kkarere"?');
            warnings++;
        } else {
            passed++;
        }
    } else {
        console.log('  -> NOT SET');
        failed++;
    }

    // 6. Google Service Account
    console.log('\n[6] Google Service Account JSON...');
    const saPath = path.resolve(__dirname, '..', process.env.GOOGLE_SERVICE_ACCOUNT_PATH || './credentials/service-account.json');
    if (fs.existsSync(saPath)) {
        try {
            const sa = JSON.parse(fs.readFileSync(saPath, 'utf-8'));
            console.log('  -> OK! Service account:', sa.client_email || 'unknown');
            passed++;
        } catch {
            console.log('  -> FAIL: file exists but invalid JSON');
            failed++;
        }
    } else {
        console.log('  -> NOT FOUND at:', saPath);
        console.log('  -> NOTE: Optional. Needed for Sheets write & Calendar API');
        warnings++;
    }

    // 7. Spreadsheet ID
    console.log('\n[7] Spreadsheet ID...');
    const ssId = process.env.SPREADSHEET_ID;
    if (ssId && ssId.length > 10) {
        console.log('  -> SET:', ssId.substring(0, 20) + '...');
        passed++;
    } else {
        console.log('  -> NOT SET or invalid');
        failed++;
    }

    // Summary
    console.log('\n========================================');
    console.log(` RESULT: ${passed} PASS / ${failed} FAIL / ${warnings} WARNING`);
    console.log('========================================');
}

verifyAll().catch(e => console.error('Verification error:', e.message));
