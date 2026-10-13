import json
import tempfile
import unittest
from pathlib import Path

from sanitize_urls import sanitize_data
from update_feed import FeedParser, archive_story
from url_safety import sanitize_url


class URLSafetyTests(unittest.TestCase):
    def setUp(self):
        # Construct a synthetic ID at runtime so tests never commit a key-like literal.
        self.key = 'ASIA' + 'A' * 16
        self.signed = ('https://example.com/paper.pdf?download=1&X-Amz-Credential='
                       + self.key + '%2F20200119%2Fregion%2Fs3%2Faws4_request'
                       + '&X-Amz-Security-Token=example-token&X-Amz-Signature=example-signature'
                       + '&X-Amz-Date=20200119T190111Z&X-Amz-Expires=300#page=2')

    def test_v4_credentials_removed_without_rewriting_other_parameters(self):
        self.assertEqual(sanitize_url(self.signed), 'https://example.com/paper.pdf?download=1#page=2')
        encoded = 'https://example.com/?q=a%20b&%58-Amz-Credential=example&x-AMZ-signature=example'
        self.assertEqual(sanitize_url(encoded), 'https://example.com/?q=a%20b')

    def test_legacy_and_google_signed_urls(self):
        for query in ['AWSAccessKeyId=example&Signature=example&Expires=300',
                      'GoogleAccessId=example&Signature=example&Expires=300',
                      'X-Goog-Credential=example&X-Goog-Signature=example&X-Goog-Expires=300']:
            self.assertEqual(sanitize_url('https://example.com/object?' + query), 'https://example.com/object')

    def test_sciencedirect_download_replaced_with_canonical_article(self):
        value = ('https://pdf.sciencedirectassets.com/271600/1-s2.0-S0167642300X00603/'
                 '1-s2.0-0167642387900359/main.pdf?X-Amz-Credential=example&X-Amz-Signature=example')
        self.assertEqual(sanitize_url(value), 'https://www.sciencedirect.com/science/article/pii/0167642387900359')

    def test_ordinary_urls_and_unrelated_signatures_are_preserved(self):
        for value in ['https://example.com/?q=a%20b#section', 'https://example.com/?signature=public-reference',
                      'https://example.com/?expires=300', '', 'https://[invalid']:
            self.assertEqual(sanitize_url(value), value)
        self.assertEqual(sanitize_url(None), '')
        self.assertEqual(sanitize_url('https://[invalid?X-Amz-Credential=example'), '')

    def test_feed_and_archive_ingestion_sanitize_before_persistence(self):
        parser = FeedParser()
        parser.feed('<li class="entry" id="42"><a class="hn" data-date="123"></a>'
                    '<a class="link" href="' + self.signed.replace('&', '&amp;') + '">Paper</a></li>')
        self.assertNotIn(self.key, parser.stories[0]['url'])
        record = archive_story({'id': 42, 'date': 123, 'link_text': 'Paper', 'link': self.signed})
        self.assertEqual(record['url'], 'https://example.com/paper.pdf?download=1#page=2')

    def test_check_is_read_only_and_cleanup_is_idempotent(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            archive = root / 'data' / 'archive'
            archive.mkdir(parents=True)
            path = archive / '2020-01-19.json'
            path.write_text(json.dumps([{'id': 42, 'url': self.signed}]))
            before = path.read_bytes()
            self.assertEqual(sanitize_data(root, check=True), (1, 1))
            self.assertEqual(path.read_bytes(), before)
            self.assertEqual(sanitize_data(root), (1, 1))
            self.assertNotIn(self.key, path.read_text())
            self.assertEqual(sanitize_data(root), (0, 0))


if __name__ == '__main__':
    unittest.main()
