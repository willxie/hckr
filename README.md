# hckr news, with dark mode

A responsive, independent recreation of [hckrnews.com](https://hckrnews.com/), originally created by Wayne Larsen. Preserves the compact chronological list, comments/points columns, homepage highlights, daily filters, and previous-day browsing. Adds dark, light, and system themes, with preferences saved in the browser.

The default appearance follows the system's light/dark setting, and **top 50%** is initially selected. Comments/points links and HN discussion-only story titles open in [HackerWeb](https://hackerweb.app/); external article titles continue to open their source. Existing browsers adopt these defaults once, then remember subsequent user choices.

**Site:** https://willxie.github.io/hckr/

## Run locally

```sh
python3 -m http.server 8000
```

Open http://localhost:8000. No npm dependencies or build step.

## Feed and deployment

GitHub Actions retrieves the public hckr news feed every 30 minutes, keeps a rolling 30-day archive in `data/news.json`, and deploys to GitHub Pages. Scheduled runs can be delayed by GitHub; the displayed timestamp indicates freshness. GitHub may suspend schedules after 60 days without repository activity. A failed source fetch preserves the existing published feed; rerun the workflow to retry.

The browser's refresh button retrieves the latest deployed snapshot and updates current points, comments, and homepage membership through the official [Hacker News API](https://github.com/HackerNews/API). Auto-refresh runs every five minutes while the tab is visible. Stories stay ordered by their first appearance in the feed. Top 10, top 20, and top 50% are selected **per calendar day** in the reader's local timezone, and remain chronological. Previously collected days are available through “load previous days”; older history starts accumulating from deployment.

Enable **GitHub Pages → Source → GitHub Actions** in the repository settings. Pushes to `main` and manual workflow runs also deploy. No API keys or external hosting are required.

This site is independent of the original hckr news and Y Combinator. Links to original browser extensions refer to the original site; extension compatibility with this copy is not guaranteed.
