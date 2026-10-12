#!/usr/bin/env python3
"""Save the public hckr news feed as JSON for a static GitHub Pages site."""
import json
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
FEED = ROOT / 'data' / 'news.json'

class FeedParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stories = []
        self.story = None
        self.capture = None
        self.in_source = False

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        classes = attrs.get('class', '').split()
        if tag == 'li' and 'entry' in classes:
            self.story = {'id': int(attrs['id']) if attrs['id'].isdigit() else attrs['id'], 'title': '', 'score': 0,
                          'descendants': 0, 'homepage': False}
        if self.story is None:
            return
        if tag == 'a' and 'hn' in classes:
            self.story['time'] = int(attrs.get('data-date', 0))
        if tag == 'a' and 'link' in classes:
            self.story['url'] = attrs.get('href', '')
            self.capture = 'title'
        if tag == 'span' and 'comments' in classes:
            self.capture = 'descendants'
        if tag == 'span' and 'points' in classes:
            self.capture = 'score'
            self.story['homepage'] = 'homepage' in classes
        if tag == 'span' and 'source' in classes:
            self.in_source = True
        if 'dead' in classes:
            self.story['dead'] = True
        if 'job' in classes:
            self.story['type'] = 'job'

    def handle_data(self, text):
        if self.story is None or not self.capture or self.in_source:
            return
        if self.capture == 'title':
            self.story['title'] += text
        else:
            try:
                self.story[self.capture] = int(text.strip())
            except ValueError:
                pass

    def handle_endtag(self, tag):
        if tag == 'span':
            self.capture = 'title' if self.in_source else None
            self.in_source = False
        if tag == 'a':
            self.capture = None
        if tag == 'li' and self.story is not None:
            self.story['title'] = self.story['title'].strip()
            if self.story.get('dead') and self.story['title'] in ('', 'undefined'):
                self.story['title'] = 'Removed story'
            if self.story['title'] and self.story.get('time'):
                self.stories.append(self.story)
            self.story = None

def archive_story(item):
    try:
        story_id = str(item['id'])
        timestamp = int(item['date'])
        if not (story_id.isdigit() or (len(story_id) == 40 and all(c in '0123456789abcdef' for c in story_id))):
            return None
        dead = item.get('dead') not in (None, False, 'false', 'null', '')
        title = str(item.get('link_text') or '').strip()
        if title == 'undefined' or not title:
            title = 'Removed story' if dead else 'Untitled story'
        return {
            'id': int(story_id) if story_id.isdigit() else story_id,
            'time': timestamp, 'title': title, 'url': item.get('link') or '',
            'score': max(0, int(item.get('points') or 0)),
            'descendants': None if item.get('comments') is None else max(0, int(item['comments'])),
            'homepage': False, 'dead': dead, 'type': item.get('type', 'story'),
        }
    except (KeyError, TypeError, ValueError):
        return None

def update():
    request = Request('https://hckrnews.com/', headers={
        'User-Agent': 'hrnw/1.0 (+https://github.com/willxie/hrnw)'})
    with urlopen(request, timeout=30) as response:
        html = response.read().decode('utf-8')
    parser = FeedParser()
    parser.feed(html)
    if len(parser.stories) < 10:
        raise RuntimeError('Source returned too few stories; preserving the saved feed.')
    old = json.loads(FEED.read_text()) if FEED.exists() else {'stories': []}
    now = datetime.now(timezone.utc)
    # Daily files retain older history; keep only the source's active window here.
    cutoff = min(s['time'] for s in parser.stories)
    merged = {s['id']: s for s in parser.stories}
    merged.update({s['id']: {**s, 'homepage': False} for s in old['stories'] if s['time'] >= cutoff and s['id'] not in merged})
    result = {'updatedAt': now.isoformat(), 'stories': sorted(merged.values(), key=lambda s: s['time'], reverse=True)}
    FEED.parent.mkdir(parents=True, exist_ok=True)
    temporary = FEED.with_suffix('.tmp')
    temporary.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    temporary.replace(FEED)
    print(f"Saved {len(result['stories'])} stories.")

if __name__ == '__main__':
    update()
