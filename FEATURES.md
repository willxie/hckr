# Feature parity audit

Reference: https://hckrnews.com/ and its public client script, inspected October 12, 2026. All five filters were exercised in the original browser and their selected story IDs were compared with this site's selection logic on the same captured records. The ID sets matched for all, top 10, top 20, top 50%, and homepage.

| Original behavior | This version |
| --- | --- |
| Chronological items that reached the HN homepage | Source appearance timestamps, distinct from submission timestamps |
| Comments, points, orange homepage points, linked source hostname | Preserved, including zero/null values and legacy job records |
| UTC daily rankings, elapsed-day scaling, tied score cutoffs | Matched against original filter results; regression tests cover boundaries and ties |
| Local day dividers and six-hour markers | Preserved; numeric and homepage filters hide time markers |
| Last Visit line, dismissed by clicking | Restored, with a persisted visit timestamp |
| Show dead setting, enabled by default | Restored; removed entries remain available with a DEAD badge |
| HackerWeb preference and new-tab preference | Preserved for points and external discussion links; comments now open the internal reader |
| Settings Done control and saved preferences | Restored |
| Previous-day loading at the bottom | Restored through mirrored daily source files, with a manual control and retry |
| Compact phone filter menu | Restored with keyboard-accessible controls |
| About, extension information, contact/source information | Local About page, anchored sections, links to original project and extensions |
| Extension-assisted unread comment counts | Built into the list; discussion visits track read counts, articles alone do not |
| Collapsible threads | Built into the minimal API-powered reader, with individual comment links and progressive loading |
| New entries notification and tab-title count in original live-update code | Implemented through polling, without inserting new rows until requested |

## Added features retained

System/light/dark themes, system theme and top 50% defaults, a theme toggle, official-API count refresh, five-minute optional foreground auto-refresh, stable scroll position during updates, offline saved-feed fallback, direct date navigation and shareable date URLs, automatic GitHub Pages publication, and internal discussion/comment URLs.

## Verification

- Original-browser filter parity: exact story ID sets for all five modes.
- Browser checks: settings persistence, internal comment and HackerWeb/HN external routing, new-tab behavior, dead visibility, blank job metrics, automatic and manual history loading, date navigation, mobile filter expansion, local About navigation, and theme behavior.
- Deterministic browser checks use temporary local fixtures: queued entries, tab notification count, reveal/dismiss controls, new / total comment counts, live-API failure fallback, offline fallback, and history failure/retry.
- Node regression tests cover score thresholds, UTC grouping, dead filtering, archive merge precedence, unread counts, links, title decoding, parent traversal, API concurrency/caching/retry, ranked replies, and unsafe URL rejection.
- Python regression tests cover source parsing, dead/job records, archive appearance dates, and preserving saved data on bad source responses.
- Comments iteration: live API loading, story and individual comment navigation, collapse/expand, mobile and dark theme checks. Deterministic browser fixtures cover reply order, pagination, failed-comment retry, deleted/dead ancestors with surviving replies, empty and missing items, and removing active HTML while retaining formatting.

The original site's old Chrome/Safari extensions remain separate third-party artifacts. This project does not claim they integrate with this GitHub Pages domain. The list's read tracking is built in, and discussions use the internal reader. External discussion links use HackerWeb or Hacker News according to the saved preference.
