# hrnw

A personal Hacker News reading list inspired by [hckr news](https://hckrnews.com/), originally created by Wayne Larsen. Intended for personal use and independently maintained. See the [feature parity audit](FEATURES.md) for the comparison and verification.

**Site:** https://willxie.github.io/hrnw/

The default theme follows the device's light/dark setting, **top 50%** is initially selected, and discussions open in [HackerWeb](https://hackerweb.app/). Other choices are remembered. External article titles open their source.

## Reading features

- Chronological homepage history, comments/points, source hostnames, job/dead badges, and homepage highlights.
- Original UTC daily rankings, partial-day scaling, and score-cutoff ties for all five filters.
- Last Visit marker, local day/time dividers, and compact mobile filters.
- HackerWeb, new-tab, show-dead, and new-comment settings, with a Done control.
- New / total comment counts for previously opened discussions.
- Automatic previous-day loading, manual history loading, date selection, and shareable `?date=YYYY-MM-DD` links.
- System/light/dark themes, optional five-minute auto-refresh, queued new entries and tab notifications, stable reading position, manual refresh, and a saved feed when offline.

## Local development and tests

```sh
python3 -m http.server 8000
node --test tests/core.test.mjs
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

GitHub Pages uses **GitHub Actions** as its source. No API keys or external hosting are required. A local About page explains the features and links to the original project, extensions, and this repository's issue tracker. Original-domain Chrome/Safari extension integration is separate; comment tracking is built into this site's list and HackerWeb supplies the discussion interface.

This site is independent of hckr news, HackerWeb, and Y Combinator.
