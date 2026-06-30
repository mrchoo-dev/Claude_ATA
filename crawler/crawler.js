require('dotenv').config();
const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR);

// ================================================
// Claude Vision으로 가격 추출
// ================================================
async function extractPriceWithClaude(screenshotPath, modelName, channel) {
  const imageData = fs.readFileSync(screenshotPath);
  const base64Image = imageData.toString('base64');

  const channelNames = { coupang: '쿠팡', gmarket: 'G마켓', himart: '하이마트' };

  try {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-sonnet-4-6',
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: 'image/png', data: base64Image } },
              {
                type: 'text',
                text: `이 이미지는 ${channelNames[channel]}에서 "${modelName}" 모델을 검색한 결과입니다.

가장 낮은 판매가격(최저가)을 만원 단위 정수로만 알려주세요.
예: 278 (278만원인 경우)

숫자만 답하세요. 가격을 찾을 수 없으면 0으로 답하세요.`
              }
            ]
          }
        ]
      },
      {
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        }
      }
    );

    const text = response.data.content[0].text.trim();
    const price = parseInt(text.replace(/[^0-9]/g, ''));
    return isNaN(price) ? 0 : price;
  } catch (err) {
    console.error('Claude Vision 오류:', err.message);
    return 0;
  }
}

// ================================================
// 채널별 크롤링 함수
// ================================================
async function crawlCoupang(page, modelName) {
  const searchUrl = `https://www.coupang.com/np/search?q=${encodeURIComponent(modelName)}&channel=user`;
  await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  return page;
}

async function crawlGmarket(page, modelName) {
  const searchUrl = `https://browse.gmarket.co.kr/search?keyword=${encodeURIComponent(modelName)}`;
  await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  return page;
}

async function crawlHimart(page, modelName) {
  const searchUrl = `https://www.himart.co.kr/search/list?keyword=${encodeURIComponent(modelName)}`;
  await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  return page;
}

const crawlFunctions = { coupang: crawlCoupang, gmarket: crawlGmarket, himart: crawlHimart };

// ================================================
// 메인 크롤링 실행 (새 스키마: product_groups + channel_models)
// ================================================
async function runCrawler() {
  console.log(`\n🚀 크롤링 시작: ${new Date().toLocaleString('ko-KR')}`);
  let savedCount = 0;

  const { data: groups, error } = await supabase
    .from('product_groups')
    .select(`
      id, brand, ata_price,
      categories(name),
      channel_models(id, channel, model_name, search_url)
    `)
    .eq('is_active', true);

  if (error) {
    console.error('모델 조회 오류:', error.message);
    return { count: 0 };
  }

  if (!groups || groups.length === 0) {
    console.log('⚠️ 등록된 모델이 없습니다. 대시보드에서 모델을 추가해주세요.');
    return { count: 0 };
  }

  // channel_models를 평탄화
  const items = [];
  groups.forEach(g => {
    (g.channel_models || []).forEach(cm => {
      items.push({
        channel_model_id: cm.id,
        channel: cm.channel,
        model_name: cm.model_name,
        ata_price: g.ata_price,
        brand: g.brand,
        category_name: g.categories?.name
      });
    });
  });

  if (items.length === 0) {
    console.log('⚠️ 채널별 모델명이 등록된 항목이 없습니다.');
    return { count: 0 };
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  for (const item of items) {
    console.log(`\n📦 ${item.category_name} | ${item.brand} | ${item.channel} | ${item.model_name}`);
    const page = await context.newPage();

    try {
      console.log(`  ⏳ 크롤링 중...`);
      await crawlFunctions[item.channel](page, item.model_name);

      const screenshotName = `${timestamp}_${item.model_name}_${item.channel}.png`;
      const screenshotPath = path.join(SCREENSHOT_DIR, screenshotName);
      await page.screenshot({ path: screenshotPath, fullPage: false });

      const price = await extractPriceWithClaude(screenshotPath, item.model_name, item.channel);
      const ataDiff = item.ata_price ? price - item.ata_price : null;

      const { error: insertError } = await supabase
        .from('price_history')
        .insert({
          channel_model_id: item.channel_model_id,
          price: price,
          screenshot_url: screenshotName,
          ata_diff: ataDiff,
          crawled_at: new Date().toISOString()
        });

      if (insertError) {
        console.error(`  ❌ DB 저장 오류:`, insertError.message);
      } else {
        savedCount++;
        console.log(`  ✅ ${price}만원 (ATA ${ataDiff !== null ? (ataDiff >= 0 ? '+' : '') + ataDiff : '-'}만원)`);
      }
    } catch (err) {
      console.error(`  ❌ 오류:`, err.message);
    } finally {
      await page.close();
    }

    await new Promise(r => setTimeout(r, 3000));
  }

  await browser.close();
  console.log(`\n✅ 크롤링 완료: ${new Date().toLocaleString('ko-KR')} (${savedCount}건 저장)\n`);
  return { count: savedCount };
}

// 직접 실행 시 (node crawler.js)
if (require.main === module) {
  runCrawler().catch(console.error);
}

module.exports = { runCrawler };
