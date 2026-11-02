# Daily news update (run on the Grok Bot box)
1. Research: The Rundown AI latest issue (https://www.therundown.ai/archive -> /articles/<slug>) + other outlets;
   Tiger public feed: https://stock-news.skytigris.cn/v2/highlight/list?region=SGP&pageCount=1&lang_content=en&edition=fundamental
   (articles at https://www.itiger.com/news/<id>; Tiger Newspress items are fully public, Reuters/Dow Jones need login -> use headline/teaser only).
2. Write news-src/YYYY-MM-DD.json (Thai spoken text, items kind "ai", "tiger" and "world" (world stock markets: US, China, Japan, Korea, India, Europe, Australia, NZ + oil/gold/bitcoin), sources with names + URLs, end with "ไม่ใช่คำแนะนำการลงทุน").
3. python3 build_news.py   (edge-tts th-TH-PremwadeeNeural -> audio/*.mp3, rebuilds news.json, keeps newest 30 days)
4. git add -A && git commit -m "news YYYY-MM-DD" && git push

App is listening-only (News + Ask tabs; Notes removed Nov 2026). Badge labels for kinds live in app.js KIND; add a new kind there before using it.
