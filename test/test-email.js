const emailSender = require('../src/email/sender');
require('dotenv').config();

async function testEmail() {
    console.log('📧 이메일 발송 테스트 시작...');
    try {
        const result = await emailSender.send({
            subject: '🧪 대박이 테스트 이메일',
            text: '이 메일이 도착했다면 SMTP 설정은 정상입니다! 충성! 🫡',
            html: '<h1>🧪 테스트 성공!</h1><p>대박이 개발부장입니다. SMTP 설정이 정상적으로 작동하고 있습니다. 🫡</p>'
        });

        if (result) {
            console.log('✅ 테스트 이메일 발송 성공!');
        } else {
            console.log('❌ 테스트 이메일 발송 실패.');
        }
    } catch (error) {
        console.error('❌ 테스트 중 에러 발생:', error);
    }
}

testEmail();
