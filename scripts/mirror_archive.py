#!/usr/bin/env python3
"""Mirror upstream daily JSON files for static, CORS-free historical browsing."""
import argparse
import json
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from update_feed import archive_story

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / 'data' / 'archive'
INDEX = ROOT / 'data' / 'archive-index.json'

def fetch_day(day):
    path = ARCHIVE / f'{day.isoformat()}.json'
    if path.exists():
        return day.isoformat(), len(json.loads(path.read_text()))
    for attempt in range(3):
        try:
            request = Request(f'https://hckrnews.com/data/{day:%Y%m%d}.js', headers={
                'User-Agent': 'hckr-dark/1.0 (+https://github.com/willxie/hckr)'})
            with urlopen(request, timeout=30) as response:
                data = json.loads(response.read())
            if not isinstance(data, list):
                raise ValueError('Unexpected archive format')
            stories = [s for item in data if (s := archive_story(item))]
            path.write_text(json.dumps(stories, ensure_ascii=False, separators=(',', ':')) + '\n')
            return day.isoformat(), len(stories)
        except HTTPError as error:
            if error.code == 404:
                return day.isoformat(), None
            if attempt == 2:
                raise
        except Exception:
            if attempt == 2:
                raise
        time.sleep(attempt + 1)

def build_index():
    days = sorted((p.stem for p in ARCHIVE.glob('*.json')), reverse=True)
    INDEX.write_text(json.dumps({'updatedAt': datetime.now(timezone.utc).isoformat(), 'days': days}, separators=(',', ':')) + '\n')
    return len(days)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--start', type=date.fromisoformat, required=True)
    parser.add_argument('--end', type=date.fromisoformat, default=datetime.now(timezone.utc).date() - timedelta(days=1))
    parser.add_argument('--workers', type=int, default=4)
    args = parser.parse_args()
    ARCHIVE.mkdir(parents=True, exist_ok=True)
    days = [args.end - timedelta(days=i) for i in range((args.end-args.start).days + 1)]
    errors = []
    found = total = 0
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        jobs = {pool.submit(fetch_day, day): day for day in days}
        for future in as_completed(jobs):
            total += 1
            try:
                day, count = future.result()
                found += count is not None
            except Exception as error:
                errors.append(f'{jobs[future]}: {error}')
            if total % 100 == 0:
                print(f'Archive: {total}/{len(days)} checked; {found} available; {len(errors)} errors', flush=True)
                build_index()
    count = build_index()
    print(f'Mirrored {count} days. Range: {args.start} to {args.end}.', flush=True)
    if errors:
        print('\n'.join(errors), flush=True)
        raise SystemExit(1)

if __name__ == '__main__':
    main()
