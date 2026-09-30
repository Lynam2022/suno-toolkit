#!/usr/bin/env python3
"""
yt_downloader.py - High-reliability YouTube audio extractor for Suno Master Studio.
Features:
- Multi-client fallback (android, ios, mweb, tv_embedded) to bypass bot verification.
- Extracts MP3 (320kbps) or WAV (Lossless) using ffmpeg.
- Local caching in downloads/yt_cache to prevent re-downloading.
- Returns clean JSON output to stdout.
"""

import sys
import os
import re
import json
import hashlib

# Force UTF-8 on Windows stdout/stderr
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

try:
    import yt_dlp
except ImportError:
    print(json.dumps({"success": False, "error": "yt-dlp is not installed in Python environment"}))
    sys.exit(1)

CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'downloads', 'yt_cache')
os.makedirs(CACHE_DIR, exist_ok=True)

def sanitize_title(title):
    if not title:
        return "youtube_audio"
    # Remove filesystem illegal characters
    cleaned = re.sub(r'[/\\?%*:|"<>#]', '_', title)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    return cleaned[:100]

def extract_video_id(url):
    m = re.search(r'(?:v=|\/shorts\/|\/embed\/|youtu\.be\/|\/v\/)([a-zA-Z0-9_-]{11})', url)
    return m.group(1) if m else None

def get_ydl_opts(target_format='mp3', outtmpl=None):
    postprocessors = []
    if target_format == 'wav':
        postprocessors.append({
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'wav',
        })
    else:
        postprocessors.append({
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '320',
        })

    opts = {
        'format': 'bestaudio/best',
        'postprocessors': postprocessors,
        'quiet': True,
        'no_warnings': True,
        'noprogress': True,
        'overwrites': True,
        'windowsfilenames': True,
        'noplaylist': True,
        'keepvideo': False,
        'extractor_args': {
            'youtube': {
                'player_client': ['android', 'ios', 'mweb', 'tv_embedded']
            }
        },
        'js_runtimes': {'node': {}}
    }
    if outtmpl:
        opts['outtmpl'] = outtmpl
    return opts

def cleanup_cache():
    deleted = 0
    freed_bytes = 0
    if os.path.exists(CACHE_DIR):
        for f in os.listdir(CACHE_DIR):
            fp = os.path.join(CACHE_DIR, f)
            try:
                if os.path.isfile(fp):
                    freed_bytes += os.path.getsize(fp)
                    os.remove(fp)
                    deleted += 1
            except Exception:
                pass
    return {
        "success": True,
        "deleted": deleted,
        "freed_bytes": freed_bytes,
        "freed_mb": round(freed_bytes / (1024 * 1024), 2)
    }

def get_info(url):
    opts = {
        'quiet': True,
        'no_warnings': True,
        'skip_download': True,
        'extractor_args': {
            'youtube': {
                'player_client': ['android', 'ios', 'mweb', 'tv_embedded']
            }
        },
        'js_runtimes': {'node': {}}
    }
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)
            return {
                "success": True,
                "id": info.get('id'),
                "title": info.get('title') or "YouTube Audio",
                "duration": info.get('duration') or 0,
                "thumbnail": info.get('thumbnail'),
                "channel": info.get('uploader') or info.get('channel') or "YouTube",
                "url": url
            }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "url": url
        }

def download_audio(url, target_format='mp3'):
    vid_id = extract_video_id(url)
    if not vid_id:
        # Fallback hash
        vid_id = hashlib.md5(url.encode('utf-8')).hexdigest()[:11]

    ext = 'wav' if target_format == 'wav' else 'mp3'
    cached_file = os.path.join(CACHE_DIR, f"{vid_id}.{ext}")
    info_file = os.path.join(CACHE_DIR, f"{vid_id}.info.json")

    # If cached file exists and is non-empty
    if os.path.exists(cached_file) and os.path.getsize(cached_file) > 1000:
        title = None
        duration = 0
        if os.path.exists(info_file):
            try:
                with open(info_file, 'r', encoding='utf-8') as f:
                    meta = json.load(f)
                    title = meta.get('title')
                    duration = meta.get('duration', 0)
            except Exception:
                pass
        if not title or title == "YouTube Audio":
            info_res = get_info(url)
            if info_res.get('success') and info_res.get('title'):
                title = info_res['title']
                duration = info_res.get('duration', 0)
                try:
                    with open(info_file, 'w', encoding='utf-8') as f:
                        json.dump({"title": title, "duration": duration, "id": vid_id}, f, ensure_ascii=False)
                except Exception:
                    pass
        title = title or f"YouTube Audio {vid_id}"
        return {
            "success": True,
            "cached": True,
            "id": vid_id,
            "title": title,
            "duration": duration,
            "filepath": cached_file,
            "filename": f"{sanitize_title(title)}.{ext}",
            "filesize": os.path.getsize(cached_file),
            "format": ext
        }

    outtmpl = os.path.join(CACHE_DIR, f"{vid_id}.%(ext)s")
    opts = get_ydl_opts(target_format, outtmpl)

    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=True)
            title = info.get('title') or f"youtube_{vid_id}"
            duration = info.get('duration') or 0

            # Save metadata
            try:
                with open(info_file, 'w', encoding='utf-8') as f:
                    json.dump({"title": title, "duration": duration, "id": vid_id}, f, ensure_ascii=False)
            except Exception:
                pass

            if os.path.exists(cached_file):
                return {
                    "success": True,
                    "cached": False,
                    "id": vid_id,
                    "title": title,
                    "duration": duration,
                    "filepath": cached_file,
                    "filename": f"{sanitize_title(title)}.{ext}",
                    "filesize": os.path.getsize(cached_file),
                    "format": ext
                }
            else:
                return {
                    "success": False,
                    "error": f"Không tìm thấy file sau khi tải: {cached_file}",
                    "url": url
                }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "url": url
        }

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "Usage: yt_downloader.py <info|download|cleanup> [url] [format]"}))
        sys.exit(1)

    action = sys.argv[1].lower()
    if action == 'cleanup':
        res = cleanup_cache()
        print(json.dumps(res, ensure_ascii=False))
        sys.exit(0)

    if len(sys.argv) < 3:
        print(json.dumps({"success": False, "error": "Missing URL parameter"}))
        sys.exit(1)

    target_url = sys.argv[2]
    fmt = sys.argv[3].lower() if len(sys.argv) > 3 else 'mp3'

    if action == 'info':
        res = get_info(target_url)
        print(json.dumps(res, ensure_ascii=False))
    elif action == 'download':
        res = download_audio(target_url, fmt)
        print(json.dumps(res, ensure_ascii=False))
    else:
        print(json.dumps({"success": False, "error": f"Unknown action: {action}"}))
