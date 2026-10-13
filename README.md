# hrnw

A personal Hacker News reading list inspired by [hckr news](https://hckrnews.com/), originally created by Wayne Larsen. Intended for personal use and independently maintained. See the [feature parity audit](FEATURES.md), [release checks](RELEASE.md), and [archived URL safety notes](SECURITY.md) for the comparison and verification.

**Site:** https://willxie.github.io/hrnw/

The default theme follows the device's light/dark setting, **top 50%** is initially selected, and comments open in hrnw’s own minimal threaded reader. Other choices are remembered. External article titles open their source.

## Reading features

- Chronological homepage history, comments/points, source hostnames, job/dead badges, and homepage highlights.
- Original UTC daily rankings, partial-day scaling, and score-cutoff ties for all five filters.
- Last Visit marker, local day/time dividers, and compact mobile filters.
- HackerWeb, new-tab, show-dead, and new-comment settings, with a Done control.
- New / total comment counts for previously opened discussions.
- Separate comments/points links, official-API discussion pages, individual comment permalinks, collapsible threads, progressive reply loading, deleted-parent handling, refresh, and retry.
- Automatic previous-day loading, manual history loading, date selection, and shareable `?date=YYYY-MM-DD` links.
- System/light/dark themes, optional five-minute auto-refresh, queued new entries and tab notifications, stable reading position, manual refresh, and a saved feed when offline.

## Local development and tests

```sh
python3 -m http.server 8000
node --test tests/*.test.mjs
python3 -m unittest discover -s scripts -p 'test_*.py'
```

Open http://localhost:8000. No npm dependencies or build step.

## Feed and deployment

GitHub Actions updates the public hckr news feed every 30 minutes and deploys static files to GitHub Pages. Daily historical files mirror the original archive beginning in June 2010 and are fetched individually as needed by the browser. Each run picks up newly available archives from the previous four days; existing archived files are immutable locally. Run a full backfill with:

```sh
python3 scripts/mirror_archive.py --start 2010-06-09
```

The source's appearance date is retained for chronology. Direct live refresh updates points, comments, and homepage membership through the [official Hacker News API](https://github.com/HackerNews/API). If a newly discovered homepage item has not reached the deployed source snapshot yet, its first local observation is used for its appearance time. Auto-refresh runs every five minutes while the tab is visible and the current feed is open. Newly discovered entries wait behind the new-entries button; existing rows update without moving the reading position. Historical browsing does not run automatic current-feed refresh.

Scheduled runs can be delayed by GitHub. The timestamp indicates freshness. GitHub may suspend schedules after 60 days without repository activity. Source or API outages preserve saved data and provide retry controls. Pushes to `main` and manual workflow runs also deploy.

GitHub Pages uses **GitHub Actions** as its source. No API keys or external hosting are required. A local About page explains the features and links to the original project, extensions, and this repository's issue tracker. Original-domain Chrome/Safari extension integration is separate; comment tracking and the discussion reader are built into this site. Both comment counts and points open the internal reader. The reader offers a Hacker News reply link; HackerWeb is an optional external link, disabled by default. Existing browsers have their old HackerWeb default switched off once without resetting other choices.

Discussion URLs use `comments.html?id=STORY_ID`; individual comment URLs use the same route with `COMMENT_ID`. Comment links resolve their parent story through the official API. Threads preserve the API’s ranked child order, limit concurrent requests to six, and load at most 20 root comments plus 40 replies initially. Further replies load on request. Comment HTML is rebuilt from an allowlist of text formatting and HTTP(S) links. Discussions need an internet connection; API failures offer retries. Refresh preserves loaded branches, collapsed comments, and reading position. A failed refresh retains the readable discussion and working reply controls. Initial loading failures do not mark a discussion as read. Opening an individual comment does not mark its entire discussion as read.

This site is independent of hckr news, HackerWeb, and Y Combinator.
