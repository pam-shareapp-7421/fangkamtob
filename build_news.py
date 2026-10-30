#!/usr/bin/env python3
"""Build news.json + Thai mp3 clips from news-src/YYYY-MM-DD.json.
Usage: python3 build_news.py   (needs: pip install edge-tts, ffmpeg)
Each source file: {"date": "YYYY-MM-DD", "items": [{"kind": "ai"|"tiger", "title", "text", "sources": [{name,url}]}]}
"""
import json, glob, os, subprocess, hashlib, datetime
ROOT = os.path.dirname(os.path.abspath(__file__))
VOICE = 'th-TH-PremwadeeNeural'
TH_DAYS = ['จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์','อาทิตย์']
TH_MON = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']
KEEP_DAYS = 30
def tts(text, path):
    import time, tempfile
    parts, cur = [], ''
    for s in [x.strip() for x in text.split('. ') if x.strip()]:
        s = s.rstrip('.') + '.'
        if cur and len(cur) + len(s) > 350: parts.append(cur); cur = s
        else: cur = (cur + ' ' + s).strip()
    if cur: parts.append(cur)
    tmp = tempfile.mkdtemp(); files = []
    for i, p in enumerate(parts):
        fp = os.path.join(tmp, f'{i:03d}.mp3')
        for attempt in range(4):
            r = subprocess.run(['edge-tts', '--voice', VOICE, '--rate=-5%', '--text', p, '--write-media', fp], capture_output=True)
            if r.returncode == 0 and os.path.getsize(fp) > 1000: break
            time.sleep(3)
        else: raise SystemExit('TTS failed for: ' + p[:80])
        files.append(fp)
    lst = os.path.join(tmp, 'list.txt')
    open(lst, 'w').write(''.join(f"file '{f}'\n" for f in files))
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lst, '-c:a', 'libmp3lame', '-b:a', '64k', '-ac', '1', path], check=True)

days = []
for f in sorted(glob.glob(os.path.join(ROOT, 'news-src', '*.json')), reverse=True)[:KEEP_DAYS]:
    d = json.load(open(f, encoding='utf-8'))
    dt = datetime.date.fromisoformat(d['date'])
    d['label'] = f"วัน{TH_DAYS[dt.weekday()]}ที่ {dt.day} {TH_MON[dt.month-1]} {dt.year+543}"
    for it in d['items']:
        h = hashlib.sha1((VOICE + it['text']).encode()).hexdigest()[:8]
        name = f"audio/{d['date']}-{it['kind']}-{h}.mp3"
        path = os.path.join(ROOT, name)
        if not os.path.exists(path):
            os.makedirs(os.path.dirname(path), exist_ok=True)
            for old in glob.glob(os.path.join(ROOT, f"audio/{d['date']}-{it['kind']}-*.mp3")): os.remove(old)
            tts(it['text'], path)
        dur = subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',path],capture_output=True,text=True).stdout.strip()
        it['audio'] = name
        it['seconds'] = round(float(dur or 0))
    days.append(d)
out = {'updated': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='minutes'), 'days': days}
json.dump(out, open(os.path.join(ROOT, 'news.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('days:', [d['date'] for d in days])
