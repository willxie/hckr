# Release checks

Reviewed October 12, 2026. Production: https://willxie.github.io/hrnw/.

## Automated validation

```sh
node --test tests/*.test.mjs
python3 -m unittest discover -s scripts -p 'test_*.py'
```

The suite contains 22 Node tests and 5 Python tests. It covers original filter parity, chronological archive merging, unread counts, source parsing, API parent traversal, request concurrency and retry, safe links, progressive-loading budgets, refresh state, deployment dependencies, consistent attribution, and readable theme contrast.

## Browser verification

Verified in the Codex in-app browser at desktop size and a 320-pixel phone viewport:

- News, About, and discussion pages display the linked hckrnews.com credit and personal-use subheading.
- The default filter remains top 50%; the system theme remains available alongside saved light/dark choices. Mobile filter controls work without horizontal overflow.
- Comment counts open the internal reader; points retain the external HackerWeb/Hacker News preference. Article links retain their source.
- Story and individual comment links resolve live API data. Deleted/dead ancestors retain replies. Collapsing, expanding, loading more, and per-comment retry work.
- Refresh preserves loaded branches, collapsed comments, and reading position. A failed refresh keeps the existing discussion and reply controls usable.
- Initial comment outages preserve unread status; successful loading records the discussion visit. Individual comment visits do not mark the entire story as read.
- Comment HTML retains readable formatting and safe web links while removing active elements, event attributes, and unsafe URL schemes.
- Theme changes survive browser Back and navigation between pages. Keyboard controls have visible focus and collapse buttons have expanded-state labels.

Failure scenarios use a temporary local fixture server; production uses the official Hacker News API. The browser checks above do not assert coverage of every browser engine. Discussions require an internet connection; the news list retains its saved-feed fallback.

## Publishing

Pushes to main run the checks, update the feed, package all referenced assets, and deploy to GitHub Pages. The runner is pinned to Ubuntu 24.04; official checkout and Pages actions use current release versions with the supported action runtime. No build step or site runtime dependencies are required. Verify the completed deployment and the production subheading/comments route after publishing.
