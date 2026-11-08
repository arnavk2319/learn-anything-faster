# Content proposal: full-stack-to-software-architect

New role `software-architect` (Software architect), `coming_soon`. Source role `full-stack-engineer` unchanged (covers python-basics, git, rest-apis, docker, sql). No existing ids changed. Reused topic: stakeholder-management (resources untouched). 12 new topics, 4 new areas, 49 resources, all `proposed`.

## Areas (4)
- architecture-foundations: fundamentals, styles, documentation.
- distributed-systems-design: scale, distributed systems, API design, data architecture.
- cloud-reliability-security: cloud/IaC, observability/SRE, security.
- architecture-practice: technical leadership, evolutionary architecture.

## New topics and edges, `topic <- learn_first`
- arch-fundamentals <- rest-apis, sql: quality attributes are easier with systems you have built.
- architectural-styles <- arch-fundamentals, docker: styles are trade-offs between quality attributes; containers are how services ship.
- system-design-scale <- arch-fundamentals, sql: scale levers (cache, shard) build on DB knowledge.
- distributed-systems <- system-design-scale: consistency and CAP follow from replication and sharding.
- api-design <- rest-apis, arch-fundamentals: extends REST to gRPC/GraphQL and versioning.
- data-architecture <- sql, distributed-systems: storage and messaging choices depend on consistency trade-offs.
- cloud-iac <- docker, arch-fundamentals: Kubernetes and Terraform build on containers.
- observability-sre <- distributed-systems: SLOs and tracing matter most in distributed systems.
- security-architecture <- arch-fundamentals, api-design: authN/Z is designed at API boundaries.
- architecture-documentation <- architectural-styles: you document structure you understand.
- technical-leadership <- architecture-documentation, stakeholder-management: design docs plus communication with stakeholders.
- evolutionary-architecture <- architectural-styles, architecture-documentation, git: migrating between styles; decisions recorded.

No cycles. Role requires 13 topics (1 reused, 12 new). New hours total 95 (rough, human to adjust).

## Notes for review
- stakeholder-management reuse pulls in its existing prerequisite ba-fundamentals (BA area) in the graph. domain-modelling, process-modelling and requirements-documentation were not reused: their chains (elicitation, Agile) are heavy for an architect path; DDD resources are a possible future addition. llm-app-deployment and model-serving not relevant.
- No YouTube or Coursera items: none could be fetched and confirmed in budget. Books (DDIA, Fundamentals of Software Architecture, Building Evolutionary Architectures) are paid so omitted; the Google SRE book is the only free-online book. Human may add.
- technical-leadership has only 3 resources and one is a duplicate page (Fowler ADR, separate id); stronger sources wanted. cloud-iac includes the same Azure patterns page as distributed-systems (separate id); cloud-iac has no hands-on Terraform tutorial page.
- Cloudflare load-balancing page returned 403 and was dropped.
- Cambridge distributed systems notes PDF (cl.cam.ac.uk/teaching/2122/ConcDisSys/dist-sys-notes.pdf) fetched but title/author not readable; dropped.
- Fowler "Who needs an architect" PDF had no readable title; dropped.
- Azure sharding URL was taken from the confirmed pattern catalogue, not fetched. MIT course page titled "6.5840 Spring 2026"; lecture videos unconfirmed.
- AWS caching and Google API guide URLs were updated to their redirect targets (builder.aws.com, docs.cloud.google.com).
- Microsoft and AWS sources are vendor-specific; Fowler, Cockburn, Ubl and Larson are well-known authors, not official bodies.
- Titles for the SRE workbook page rendered as "Google SRE - Continuous Improvement To Get Reliability"; title recorded as the chapter name, human to check.
