#!/usr/bin/env python3
"""Sanitize persisted feed/archive links, or check without changing files."""
import argparse
import json
from pathlib import Path
from url_safety import sanitize_url

ROOT = Path(__file__).resolve().parents[1]


def sanitize_data(root=ROOT, check=False):
    changed_urls = changed_files = 0
    paths = [root / 'data' / 'news.json', *sorted((root / 'data' / 'archive').glob('*.json'))]
    for path in paths:
        if not path.exists():
            continue
        data = json.loads(path.read_text())
        stories = data.get('stories', []) if isinstance(data, dict) else data
        changed = False
        for story in stories:
            previous = story.get('url', '')
            sanitized = sanitize_url(previous)
            if sanitized != previous:
                story['url'] = sanitized
                changed_urls += 1
                changed = True
        if changed:
            changed_files += 1
            if not check:
                kwargs = {'indent': 2} if isinstance(data, dict) else {'separators': (',', ':')}
                temporary = path.with_suffix('.tmp')
                temporary.write_text(json.dumps(data, ensure_ascii=False, **kwargs) + '\n')
                temporary.replace(path)
    return changed_urls, changed_files


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    urls, files = sanitize_data(check=args.check)
    print(f'{"Found" if args.check else "Sanitized"} {urls} signed URLs in {files} files.')
    if args.check and urls:
        raise SystemExit(1)
