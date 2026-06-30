require('dotenv').config();
const cron = require('node-cron');
const { runCrawler } = require('./crawler');

console.log('⏰ ATA 가격 모니터링 스케줄러 시작');
console.log('📅 실행 시간: 매주 월요일 오전 9시, 토요일 오후 1시\n');

// 매주 월요일 오전 9시
cron.schedule('0 9 * * 1', async () => {
  console.log('🌅 월요일 오전 9시 크롤링 시작');
  await runCrawler();
}, { timezone: 'Asia/Seoul' });

// 매주 토요일 오후 1시
cron.schedule('0 13 * * 6', async () => {
  console.log('🌇 토요일 오후 1시 크롤링 시작');
  await runCrawler();
}, { timezone: 'Asia/Seoul' });

// 시작하자마자 1회 즉시 실행 (테스트용 - 필요없으면 주석처리)
// runCrawler();

console.log('✅ 스케줄러 대기 중... (Ctrl+C로 종료)');
