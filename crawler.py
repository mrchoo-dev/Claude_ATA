import os
import time
import random
import base64
import json
from datetime import datetime
from DrissionPage import ChromiumPage, ChromiumOptions
from supabase import create_client
import requests

# ================================================
# 설정
# ================================================
SUPABASE_URL = "https://ycopchmcvjjbcfopuywy.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inljb3BjaG1jdmpqYmNmb3B1eXd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1NjI3NzQsImV4cCI6MjA5ODEzODc3NH0.maP1adRd7tSuChZw5TtiMEyXPl8vm8ZosGI-ZyMy0QA"
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "여기에 키 입력")

SCREENSHOT_DIR = "screenshots"
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

CHANNEL_NAMES = {"coupang": "쿠팡", "gmarket": "G마켓", "himart": "하이마트"}

# ================================================
# Claude Vision으로 가격 추출
# ================================================
def extract_price_with_claude(screenshot_path, model_name, channel):
    with open(screenshot_path, "rb") as f:
        image_data = base64.b64encode(f.read()).decode("utf-8")

    try:
        response = requests.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json"
            },
            json={
                "model": "claude-sonnet-4-6",
                "max_tokens": 500,
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": "image/png",
                                    "data": image_data
                                }
                            },
                            {
                                "type": "text",
                                "text": f"이 이미지는 {CHANNEL_NAMES[channel]}에서 '{model_name}' 모델의 상품 페이지입니다.\n\n판매가격(최저가)을 원 단위 정수로만 알려주세요.\n예: 3313610 (3,313,610원인 경우)\n\n쉼표, 원, 공백 없이 숫자만 답하세요. 가격을 찾을 수 없으면 0으로 답하세요."
                            }
                        ]
                    }
                ]
            }
        )
        text = response.json()["content"][0]["text"].strip()
        price = int("".join(filter(str.isdigit, text)))
        return price
    except Exception as e:
        print(f"  Claude Vision 오류: {e}")
        return 0

# ================================================
# 채널별 URL 생성
# ================================================
def get_url(item):
    if item.get("search_url"):
        return item["search_url"]
    
    model = item["model_name"]
    channel = item["channel"]
    
    if channel == "coupang":
        return f"https://www.coupang.com/np/search?q={model}&channel=user"
    elif channel == "gmarket":
        return f"https://browse.gmarket.co.kr/search?keyword={model}"
    elif channel == "himart":
        return f"https://www.himart.co.kr/search/list?keyword={model}"

# ================================================
# 메인 크롤러
# ================================================
def run_crawler():
    print(f"\n🚀 크롤링 시작: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    saved_count = 0

    # DB에서 모델 가져오기
    result = supabase.table("product_groups")\
        .select("id, brand, ata_price, categories(name), channel_models(id, channel, model_name, search_url)")\
        .eq("is_active", True)\
        .execute()

    groups = result.data
    if not groups:
        print("⚠️ 등록된 모델이 없습니다.")
        return

    # 평탄화
    items = []
    for g in groups:
        for cm in g.get("channel_models", []):
            items.append({
                "channel_model_id": cm["id"],
                "channel": cm["channel"],
                "model_name": cm["model_name"],
                "search_url": cm.get("search_url"),
                "ata_price": g.get("ata_price"),
                "brand": g["brand"],
                "category_name": g.get("categories", {}).get("name", "")
            })

    if not items:
        print("⚠️ 채널별 모델이 없습니다.")
        return

    # DrissionPage 브라우저 설정
    options = ChromiumOptions()
    options.headless(False)  # 창 띄우기 (봇 감지 우회)
    options.set_argument("--no-sandbox")
    options.set_argument("--disable-blink-features=AutomationControlled")
    options.set_user_agent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    )

    page = ChromiumPage(options)
    timestamp = datetime.now().strftime("%Y-%m-%dT%H-%M-%S")

    for item in items:
        print(f"\n📦 {item['category_name']} | {item['brand']} | {item['channel']} | {item['model_name']}")

        try:
            url = get_url(item)
            print(f"  ⏳ 접속 중: {url[:60]}...")
            page.get(url)

            # 랜덤 딜레이 (봇 감지 우회)
            delay = random.uniform(3, 6)
            time.sleep(delay)

            # 스크린샷
            screenshot_name = f"{timestamp}_{item['model_name']}_{item['channel']}.png"
            screenshot_path = os.path.join(SCREENSHOT_DIR, screenshot_name)
            page.get_screenshot(path=SCREENSHOT_DIR, name=screenshot_name)

            # Claude Vision으로 가격 추출
            price = extract_price_with_claude(screenshot_path, item["model_name"], item["channel"])

            # ATA 차이 계산 (원단위)
            ata_price_won = item["ata_price"] * 10000 if item["ata_price"] else None
            ata_diff = price - ata_price_won if ata_price_won and price else None

            # DB 저장
            supabase.table("price_history").insert({
                "channel_model_id": item["channel_model_id"],
                "price": price,
                "screenshot_url": screenshot_name,
                "ata_diff": ata_diff,
                "crawled_at": datetime.now().isoformat()
            }).execute()

            saved_count += 1
            price_man = round(price / 10000) if price else 0
            print(f"  ✅ {price_man}만원 ({price:,}원)")

        except Exception as e:
            print(f"  ❌ 오류: {e}")

        # 채널 간 랜덤 딜레이
        time.sleep(random.uniform(3, 7))

    page.quit()
    print(f"\n✅ 완료: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ({saved_count}건 저장)\n")

if __name__ == "__main__":
    run_crawler()
