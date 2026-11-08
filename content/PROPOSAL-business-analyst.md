# Content proposal: full-stack-to-business-analyst

New role `business-analyst` (Business analyst), `coming_soon`. Source role `full-stack-engineer` unchanged (covers python-basics, git, rest-apis, docker, sql). No existing ids changed. Reused topics: probability-statistics, pandas, data-cleaning, exploratory-data-analysis, statistical-inference, data-visualisation-bi, data-storytelling (their resources untouched). 10 new topics, 2 new areas. All resources `proposed`.

## Areas (2)
- business-analysis: role fundamentals, requirements, process and domain modelling, Agile.
- business-metrics: KPIs, experiments, decisions.

## New topics and edges, `topic <- learn_first`
- ba-fundamentals <- (none): the role and vocabulary come first.
- stakeholder-management <- ba-fundamentals: who to engage and how.
- agile-scrum-for-ba <- ba-fundamentals: the delivery context BAs work in.
- requirements-elicitation <- ba-fundamentals, stakeholder-management: you elicit from stakeholders.
- requirements-documentation <- requirements-elicitation, agile-scrum-for-ba: stories and acceptance criteria record elicited needs in backlog form.
- process-modelling <- requirements-elicitation: model processes you have discovered.
- domain-modelling <- process-modelling, requirements-documentation, sql: model entities and rules; SQL covered by source role.
- business-metrics-kpis <- ba-fundamentals, sql: measures are queried from data.
- product-ab-testing <- business-metrics-kpis, statistical-inference: experiments test a metric, read with statistics.
- data-driven-decision-making <- business-metrics-kpis, product-ab-testing, data-storytelling: recommendations built on evidence and communicated.

No cycles. Role requires 17 topics (7 reused, 10 new). New hours total 61 (rough, human to adjust). Resources: 39 across 10 topics; 3-5 per topic.

## Notes for review
- Unconfirmed: IIBA "3 Communication Tips" blog returned 403 (URL from search only; titles not verified). verify-urls may flag it.
- The IIBA BABOK landing page (`/business-analysis-body-of-knowledge/`) and `/business-analysis-standards/babok/` were 404, so BABOK itself is represented by the Standard preface and the Foundational Standards page. The BABOK Guide pages under `my-iiba` and the BABOK-applied stakeholder analysis page redirect to login and were dropped.
- uml-diagrams.org failed certificate verification and was dropped. Mind Tools stakeholder analysis redirects to a members domain and was dropped. Two Atlassian guesses (team-playbook stakeholder-analysis, OKR page) were 404 and dropped.
- Atlassian KPI/product metrics/dashboard pages: only the title was confirmed (page body truncated by fetch).
- Coursera courses marked `is_free: false`; free audit not confirmed. Udacity A/B Testing marked `is_free: true` but unverified (Udacity may now require enrolment); human to check.
- requirements-elicitation has only 3 resources and one is a practitioner site; the IIBA Standard preface and engagement article also appear under other topics (separate ids). A stronger BABOK elicitation source or a video series is wanted. data-driven-decision-making has 3, none is a video series.
- process-modelling resources are specs and vendor pages, no tutorial series or video; bpmn.org content was a navigation shell.
- Video series (YouTube) not added: none could be fetched and confirmed in budget.
- Mountain Goat and the Fowler pages are by well-known authors, not official bodies.

## Dropped by verify-urls (HTTP 403, bot-blocked; pages likely fine, human may re-add)
- agile-scrumorg-po-backlog (scrum.org product backlog management path)
- stakeholder-iiba-communication-tips (IIBA blog)
