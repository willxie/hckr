import io
import json
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

from update_feed import FeedParser
import update_feed


def story_html(story_id=42, title='A &amp; B', extra='', timestamp=1791796451):
    return f'''<li class="entry row" id="{story_id}">
    <a class="hn story {extra}" data-date="{timestamp}"><p>
    <span class="comments">12</span><span class="points homepage">50</span></p></a>
    <a class="link story {extra}" href="https://example.com/">{title}
    <span class="source">(example.com)</span></a></li>'''


class FeedTests(unittest.TestCase):
    def test_parse_counts_title_source_and_homepage(self):
        parser = FeedParser()
        parser.feed(story_html())
        self.assertEqual(parser.stories, [{
            'id': 42, 'title': 'A & B', 'score': 50, 'descendants': 12,
            'homepage': True, 'time': 1791796451, 'url': 'https://example.com/'}])

    def test_dead_stories_and_jobs_are_preserved(self):
        parser = FeedParser()
        parser.feed(story_html(extra='dead') + story_html(43, extra='job'))
        self.assertEqual(len(parser.stories), 2)
        self.assertTrue(parser.stories[0]['dead'])
        self.assertEqual(parser.stories[1]['id'], 43)
        self.assertEqual(parser.stories[1]['type'], 'job')

    def test_source_window_merge_and_invalid_feed_preservation(self):
        now = datetime.now(timezone.utc)
        recent = int((now-timedelta(days=5)).timestamp())
        expired = int((now-timedelta(days=31)).timestamp())
        html = ''.join(story_html(i, timestamp=int(now.timestamp())) for i in range(1,11))
        with tempfile.TemporaryDirectory() as directory:
            feed = Path(directory)/'news.json'
            feed.write_text(json.dumps({'stories': [
                {'id': 100, 'time': int(now.timestamp()), 'title': 'Previous story', 'homepage': True},
                {'id': 101, 'time': expired, 'title': 'Expired story'}]}))
            with patch.object(update_feed, 'FEED', feed), patch.object(update_feed, 'urlopen', return_value=io.BytesIO(html.encode())):
                update_feed.update()
            saved = json.loads(feed.read_text())
            self.assertEqual(len(saved['stories']), 11)
            self.assertFalse(next(s for s in saved['stories'] if s['id']==100)['homepage'])
            self.assertNotIn(101, [s['id'] for s in saved['stories']])
            before = feed.read_bytes()
            with patch.object(update_feed, 'FEED', feed), patch.object(update_feed, 'urlopen', return_value=io.BytesIO(b'<html>Unavailable</html>')):
                with self.assertRaises(RuntimeError):
                    update_feed.update()
            self.assertEqual(feed.read_bytes(), before)

    def test_archive_records_use_appearance_time_not_submission_time(self):
        result = update_feed.archive_story({'id': '42', 'date': 1791590148, 'time': '1791324659',
            'link_text': 'Archive story', 'points': 10, 'comments': None, 'dead': False})
        self.assertEqual(result['time'], 1791590148)
        self.assertIsNone(result['descendants'])
        self.assertFalse(result['homepage'])

    def test_removed_title_and_hash_job_id(self):
        dead = update_feed.archive_story({'id':'42', 'date':1791590148, 'link_text':'undefined', 'dead':True})
        self.assertEqual(dead['title'], 'Removed story')
        job = update_feed.archive_story({'id':'a'*40,'date':1791590148,'link_text':'We are hiring','type':'job'})
        self.assertEqual(job['id'],'a'*40)
        self.assertEqual(job['type'],'job')


if __name__ == '__main__':
    unittest.main()
