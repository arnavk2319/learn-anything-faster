# System Design Mastery Guide — Basics → Intermediate → Advanced

Concepts, question banks and model answers, organised by the level a system design professional is expected to reach. Companion to the problems guide (which solves 37 specific design problems); this guide teaches the **building blocks and reasoning** behind those answers.

**Structure:** 3 stages × 7 topics = 21 topics. Each topic has **Concepts** (what you must know), **Question bank** (questions with best answers) and **Pitfalls** (what weak candidates say).

| Stage | Who should be fluent | Topics |
|---|---|---|
| **1. Basics** | Every engineer (junior to mid) | 1 Metrics and estimation · 2 Networking and APIs · 3 Load balancing and CDN · 4 Database fundamentals · 5 Caching · 6 Storage types · 7 Auth and security basics |
| **2. Intermediate** | Mid to senior engineer | 8 Replication · 9 Sharding and consistent hashing · 10 Messaging and event-driven design · 11 Microservices and resilience · 12 Consistency, CAP and distributed transactions · 13 Search and specialised data structures · 14 Observability and deployment |
| **3. Advanced** | Senior / staff / architect | 15 Consensus and coordination · 16 Storage engine internals and distributed databases · 17 Stream processing and data pipelines · 18 Multi-region, DR and conflict resolution · 19 High-scale patterns (hot keys, tail latency, overload) · 20 Multi-tenancy, security and compliance at scale · 21 ML/LLM systems at scale |

## How to answer any design question (the meta-skill)

1. **Clarify** requirements (functional, non-functional, scale, out-of-scope). 2. **Estimate** (QPS, storage, bandwidth). 3. **Define API and data model.** 4. **Draw the simplest working design**, then 5. **find the bottleneck and scale that**, 6. **discuss trade-offs, failure modes, monitoring**. Always say *why*, name the alternative you rejected, and quantify when you can.

**Language of trade-offs (use these phrases):** "consistency vs availability", "latency vs throughput", "read-heavy vs write-heavy", "cost vs durability", "simplicity vs flexibility", "build vs buy", "now vs later (what I'd defer)".

---

# STAGE 1 — BASICS

## 1. Metrics, SLAs and back-of-envelope estimation

**Concepts**
- **Latency** (time per request; use percentiles p50/p95/p99, never averages), **throughput** (requests or bytes per second), **availability** (fraction of time serving correctly), **durability** (data not lost), **scalability** (performance holds as load grows), **reliability** (works correctly under faults).
- **SLI** = measurement (p99 latency, success ratio); **SLO** = internal target (99.9% success over 30 days); **SLA** = contractual promise with penalties (looser than the SLO). **Error budget** = 1 − SLO; spend it on releases.
- **Nines:** 99% ≈ 3.65 days/yr down · 99.9% ≈ 8.76 h/yr (43.8 min/month) · 99.99% ≈ 52.6 min/yr · 99.999% ≈ 5.26 min/yr. Serial dependencies **multiply** availability (0.999 × 0.999 ≈ 0.998); redundancy in parallel improves it (1 − (1 − a)ⁿ).
- **Vertical** (bigger machine: simple, has a ceiling and single point of failure) vs **horizontal** (more machines: needs statelessness or partitioning).
- **Latency numbers to remember:** memory ≈ 100 ns · SSD random read ≈ 100 µs · same-datacentre round trip ≈ 0.5 ms · HDD seek ≈ 10 ms · cross-continent round trip ≈ 150 ms. Memory is ~1000× faster than SSD; a network hop in-region costs ~5× an SSD read.
- **Estimation recipe:** DAU → requests/user/day → ÷ 86,400 s = average QPS → × 2–3 for peak. Storage = records/day × size × retention × replication factor. Bandwidth = QPS × payload size.

**Worked example:** 100M DAU, 10 reads/user/day = 10⁹ reads/day ≈ 11,600 QPS average, ≈ 30k peak. If 1 write per 10 reads at 1 KB: 10⁸ writes/day × 1 KB = 100 GB/day ≈ 36 TB/yr before replication (×3 ≈ 110 TB).

**Question bank**
- **Q: Why do we use p99 instead of the average latency?**
  A: Averages hide the tail. If 1% of requests take 5 s, the mean can still look fine, yet a page that makes 20 backend calls hits a slow one in ~18% of loads (1 − 0.99²⁰). Users and downstream callers experience the tail, so SLOs are set on percentiles.
- **Q: Two services in series are each 99.9% available. What is the system's availability? How would you improve it?**
  A: ≈ 99.8% (0.999²). Improve by removing the serial dependency (cache or fallback), making calls async, or adding redundancy so the failure of one instance doesn't fail the request.
- **Q: What is the difference between SLA, SLO and SLI?**
  A: SLI is the metric, SLO the target on that metric, SLA the external contract with consequences. Teams alert on SLO burn rate, and the SLA is deliberately looser so you breach your internal target first.
- **Q: Estimate storage for a service storing 500M photos at 3 MB with 3 renditions of 20% size each, replicated ×3.**
  A: Per photo 3 MB + 3 × 0.6 MB = 4.8 MB; × 500M = 2.4 PB; × 3 replicas = 7.2 PB (erasure coding could cut the overhead from 3× to ~1.5×).
- **Q: When does horizontal scaling not help?**
  A: When the bottleneck is a single shared resource (one DB primary, a global lock, a hot key) or the work is inherently serial. Then you need partitioning, caching or removing the shared state, not more app servers.

**Pitfalls:** quoting averages; forgetting peak vs average; not multiplying by replication; precision theatre (use powers of ten, round aggressively and state assumptions).

---

## 2. Networking fundamentals and API design

**Concepts**
- **Request path:** DNS lookup (cached, TTL) → TCP handshake (1 RTT) → TLS handshake (1–2 RTT, 0–1 with TLS 1.3/resumption) → HTTP request. HTTP/2 multiplexes streams on one connection; HTTP/3 (QUIC over UDP) removes TCP head-of-line blocking and speeds connection setup.
- **TCP vs UDP:** TCP is reliable, ordered, congestion-controlled; UDP is connectionless and low latency (video, games, DNS, QUIC).
- **API styles:** **REST** (resources, verbs, cacheable, simple), **gRPC** (HTTP/2 + protobuf, strongly typed, streaming, great service-to-service), **GraphQL** (client chooses fields; fewer round trips, harder caching and cost control).
- **Real-time:** short polling (wasteful), long polling, **Server-Sent Events** (one-way server → client over HTTP), **WebSocket** (full duplex, stateful connections).
- **API design essentials:** resource naming, correct status codes, **pagination** (cursor/keyset beats offset at scale), **idempotency** (PUT/DELETE inherently; POST via idempotency key), **versioning** (`/v1`), rate limiting headers, consistent error bodies, backwards-compatible evolution (add fields, don't repurpose).
- **Idempotent** means repeating the call has the same effect as doing it once, which is essential because networks retry.

**Question bank**
- **Q: What happens when you type a URL and press Enter?**
  A: Browser checks caches → DNS resolves host (recursive resolver → root/TLD/authoritative) → TCP connect → TLS handshake → HTTP request goes through CDN/edge → load balancer → app server → data layer → response travels back; browser parses HTML, fetches sub-resources (reusing the HTTP/2 connection), renders. Mention where caching can short-circuit each step.
- **Q: REST vs gRPC vs GraphQL, when would you pick each?**
  A: REST for public, cacheable, human-friendly APIs; gRPC for internal low-latency typed service calls and streaming; GraphQL when many clients need different shapes of the same data and you can afford the complexity (query-cost limits, caching by persisted queries).
- **Q: Why is offset pagination a problem at scale?**
  A: `OFFSET 1,000,000` still scans and discards a million rows (O(offset)), and inserts during paging cause duplicates or skips. Use keyset/cursor pagination: `WHERE (created_at, id) < (:last_ts, :last_id) ORDER BY created_at DESC, id DESC LIMIT 20` backed by a composite index.
- **Q: How do you make a payment `POST` safe to retry?**
  A: Client sends an `Idempotency-Key`; the server stores key → result with a unique constraint and returns the stored result on a repeat; the same key is forwarded to the payment provider.
- **Q: WebSocket vs SSE vs long polling?**
  A: SSE for server → client streams (notifications, LLM token streams); WebSocket when both sides send frequently (chat, collaboration); long polling as a fallback through restrictive proxies. WebSockets are stateful, so they need sticky routing or a registry, and connection-aware deploys.
- **Q: How do you evolve an API without breaking clients?**
  A: Additive changes only within a version, tolerate unknown fields, deprecate with sunset headers and metrics on old-version usage, run old and new versions in parallel, and contract-test consumers.

**Pitfalls:** treating all failures as retryable; unbounded list endpoints; using offset pagination on large tables; ignoring connection setup cost for chatty services.

---

## 3. Load balancing, reverse proxies and CDNs

**Concepts**
- **Load balancer** distributes traffic and removes unhealthy nodes. **L4** (TCP/UDP, fast, no content awareness) vs **L7** (HTTP-aware: routing by path/header, TLS termination, auth, retries).
- **Algorithms:** round robin, weighted RR, **least connections**, least response time, IP hash / **consistent hashing** (affinity), random-two-choices ("power of two choices" gives near-optimal balance cheaply).
- **Health checks** (active and passive), **connection draining** on deploys, **sticky sessions** (avoid by keeping services stateless; store sessions in a shared store or signed tokens).
- **Reverse proxy** (Nginx/Envoy): TLS termination, compression, caching, rate limiting, request buffering. **API gateway** adds auth, quotas, routing, transformation.
- **LB high availability:** active-passive pair with a floating IP, or DNS/anycast across many LBs; the LB must not be a single point of failure.
- **CDN:** geographically distributed caches near users; serves static content and increasingly dynamic/edge compute. **Pull** (fetch from origin on miss) vs **push** (pre-populate). Controls: `Cache-Control` (max-age, s-maxage, stale-while-revalidate), ETag/Last-Modified, versioned URLs (`app.3f9a.js`) for instant invalidation, purge APIs.
- **GSLB/Anycast:** route users to nearest healthy region.

**Question bank**
- **Q: L4 or L7 load balancer?**
  A: L4 when you need raw speed and protocol-agnostic balancing (databases, gaming, TLS passthrough); L7 when you route by URL/header, terminate TLS, do canary splits or auth. Large systems chain both: L4 at the edge, L7 inside.
- **Q: How do you avoid the load balancer being a single point of failure?**
  A: Multiple LB instances behind anycast or DNS, or an active-passive pair with a virtual IP and health-checked failover; in cloud, use the managed multi-AZ LB.
- **Q: Round robin gives uneven load. Why, and what's better?**
  A: Requests differ in cost and connections last different lengths, so equal request counts ≠ equal load. Use least-connections or power-of-two-choices, ideally with weights reflecting instance size.
- **Q: How do you invalidate a CDN cache quickly?**
  A: Prefer immutable, content-hashed filenames with long TTLs so there is nothing to invalidate; for mutable content use short TTL + `stale-while-revalidate`, or a purge API (slower and rate-limited).
- **Q: What traffic should not be cached at the CDN?**
  A: Per-user private data (unless keyed correctly and marked `private`), responses with `Set-Cookie`, write endpoints, and anything where staleness breaks correctness (balances, inventory).
- **Q: How do you do zero-downtime deploys with a load balancer?**
  A: Rolling or blue/green: bring up new instances, pass health checks, shift traffic gradually (canary), drain connections from old instances, keep rollback one switch away.

**Pitfalls:** sticky sessions masking stateful design; health checks that only test "process up", not "dependencies OK"; caching authenticated pages publicly.

---

## 4. Database fundamentals

**Concepts**
- **Relational (SQL):** schema, joins, **ACID** (Atomicity, Consistency, Isolation, Durability), strong tooling; great default. **NoSQL families:** key-value (DynamoDB, Redis), document (MongoDB), wide-column (Cassandra, Bigtable), graph (Neo4j). Choose by **access pattern**, not fashion.
- **Indexes:** B-tree (range + equality, default), hash (equality), composite (column order matters: leftmost prefix), covering index (answers from the index alone), partial index, full-text/GIN. Cost: write amplification and storage. Index selectivity matters; low-cardinality columns rarely help.
- **Query performance:** read the plan (`EXPLAIN`), avoid N+1 queries, avoid `SELECT *`, batch writes, keep transactions short.
- **Normalisation** reduces redundancy and anomalies; **denormalisation** duplicates data to avoid joins in read-heavy systems, at the cost of update complexity.
- **Isolation levels:** Read Committed (no dirty reads) → Repeatable Read / Snapshot → Serializable. Anomalies: dirty read, non-repeatable read, phantom read, **lost update**, **write skew**. MVCC lets readers not block writers.
- **Connection pooling** (DB connections are expensive; use a pooler like PgBouncer), **migrations** (expand/contract, backwards compatible).

**Question bank**
- **Q: SQL or NoSQL for X?**
  A: Start from access patterns and consistency needs. Need joins, transactions and ad-hoc queries (orders, billing) → relational. Need massive write throughput, simple key access, flexible schema, horizontal scale (activity feeds, time-series, sessions) → NoSQL. State that a single Postgres handles far more than people assume (thousands of QPS, TBs), so don't shard prematurely.
- **Q: A query on a 100M-row table is slow. How do you diagnose it?**
  A: `EXPLAIN ANALYZE` to see seq scan vs index scan and row estimates; check index existence and column order; look for functions on indexed columns that defeat the index; check statistics freshness; consider covering/partial index, pagination style, or query rewrite; only then partitioning or caching.
- **Q: Explain a composite index `(a, b, c)`. Which queries can use it?**
  A: Those that filter on a, on a+b, or a+b+c (leftmost prefix); not b alone. Equality columns first, range column last.
- **Q: What is write skew and how do you prevent it?**
  A: Two transactions read overlapping data, make disjoint writes, and together violate an invariant (two doctors both go off-call). Snapshot isolation allows it; prevent with Serializable isolation, `SELECT … FOR UPDATE` on the guarded rows, or a constraint.
- **Q: How do you prevent overselling the last item in stock?**
  A: Atomic conditional update: `UPDATE stock SET qty = qty - 1 WHERE sku = :s AND qty >= 1` and check affected rows = 1, or optimistic locking with a version column; avoid read-then-write in application code.
- **Q: ACID vs BASE?**
  A: ACID gives strict transactional guarantees (usually on a single node/shard); BASE (Basically Available, Soft state, Eventually consistent) trades immediacy of consistency for availability and scale. Many real systems use ACID for money, BASE for feeds.

**Pitfalls:** indexing every column; using UUIDv4 primary keys on clustered B-tree tables without noting insert locality cost (UUIDv7/ULID or sequential keys are friendlier); storing blobs in the DB; long transactions holding locks.

---

## 5. Caching

**Concepts**
- **Where:** client/browser, CDN, reverse proxy, application (in-process), distributed cache (Redis/Memcached), DB buffer pool. Each layer cuts latency and load.
- **Patterns:** **cache-aside** (app reads cache, on miss loads DB and fills; default), **read-through**, **write-through** (write cache and DB synchronously; consistent, slower writes), **write-back/behind** (write cache, flush async; fast, risk of loss), **refresh-ahead**.
- **Eviction:** LRU, LFU, FIFO, TTL; sized by working set, not total data.
- **Invalidation** is the hard part: TTL (simple, bounded staleness), delete-on-write (preferred over update-on-write to avoid races), event-driven invalidation, versioned keys.
- **Failure modes:** **stampede / thundering herd** (many misses at once on an expired hot key → single-flight lock, jittered TTL, stale-while-revalidate), **penetration** (queries for non-existent keys → cache negatives, Bloom filter), **avalanche** (mass expiry or cache loss → randomised TTLs, warm-up, replicas), **hot key** (one key overloads a shard → local L1 cache, key replication/suffix sharding).
- **Metrics:** hit ratio, eviction rate, latency, memory. A cache at 90% hit ratio cuts DB load 10×; at 99%, 100×.
- **Redis data structures** matter: strings, hashes, lists, sets, sorted sets (leaderboards, rate limiting), streams, HyperLogLog, bitmaps, geo.

**Question bank**
- **Q: Cache-aside vs write-through?**
  A: Cache-aside is simple and resilient (cache outage degrades to DB) but can serve stale data after writes unless you delete on write. Write-through keeps the cache fresh and consistent for read-after-write but doubles write latency and caches data that may never be read.
- **Q: Why delete the key on write instead of updating it?**
  A: Concurrent writers can apply updates to the cache out of order, leaving a stale value forever. Deleting makes the next read reload the latest committed value. (Still race-prone: use short TTL or delayed double-delete for critical paths.)
- **Q: What is a cache stampede and how do you stop it?**
  A: A popular key expires and thousands of requests hit the DB simultaneously. Use a per-key lock / single-flight so one request rebuilds while others wait or get stale data, jitter TTLs, and refresh popular keys ahead of expiry.
- **Q: How would you cache a user's personalised feed?**
  A: Cache IDs, not hydrated objects (small, shareable); hydrate objects from a separate object cache; use per-user keys with TTL; precompute for active users only; invalidate via events on new posts.
- **Q: What would you not put in a cache?**
  A: Data that needs strict read-after-write consistency with no tolerable staleness, rarely read data (low hit ratio wastes memory), huge objects, or anything you can't safely lose without a source of truth behind it.
- **Q: Redis single-threaded? How does it reach 100k ops/s?**
  A: Command execution is single-threaded but in-memory, with I/O multiplexing, no lock contention and very cheap operations; scale further with sharding (Redis Cluster) and replicas.

**Pitfalls:** treating cache as the source of truth; caching without a TTL; ignoring hot keys; not stating the consistency model of the cache.

---

## 6. Storage types and choosing the right one

**Concepts**
- **Block storage** (EBS, SAN): raw volumes, low latency, attached to one VM; databases. **File storage** (NFS/EFS): shared hierarchical file system. **Object storage** (S3/GCS): flat namespace, key → blob + metadata, virtually unlimited, high durability (11 nines), eventual-to-strong consistency depending on provider, cheap; HTTP API; not for small random updates.
- **Tiers:** hot (SSD/standard) → warm (infrequent access) → cold/archive (Glacier). Lifecycle rules move data automatically.
- **Durability techniques:** replication (3×, simple, 200% overhead), **erasure coding** (e.g. 10+4 → 1.4× overhead, tolerates 4 losses, costlier reads/repairs), checksums, scrubbing.
- **Large-file patterns:** chunking + multipart upload, **pre-signed URLs** (client uploads directly to object storage, not through your servers), content-addressed storage (hash as key; free dedupe), resumable uploads.
- **Compression and formats:** Parquet/ORC (columnar, analytics), Avro/Protobuf (row, schemas, streaming), JSON (human-friendly, large).
- **OLTP vs OLAP:** row stores for transactions; column stores/warehouses (BigQuery, Snowflake, ClickHouse) for scans and aggregates; don't run heavy analytics on the primary.

**Question bank**
- **Q: Where do you store user-uploaded images and why not in the database?**
  A: Object storage with metadata in the DB. Blobs bloat the DB, hurt backups and caching, and cost far more per GB; object storage is cheap, durable and CDN-friendly. Upload via pre-signed URL to bypass app servers.
- **Q: Replication vs erasure coding?**
  A: Replication is simple, fast to read and repair, but costs 3× storage. Erasure coding gives similar durability at ~1.3–1.5× at the cost of CPU and slower reconstruction; used for large, colder data.
- **Q: How do you support resumable uploads of 5 GB files?**
  A: Split into parts (e.g. 8–64 MB), upload in parallel with part numbers/ETags via multipart upload, track completed parts in the metadata store, retry only failed parts, then commit; verify with checksums.
- **Q: OLTP vs OLAP: why separate them?**
  A: Different access patterns (point reads/writes vs large scans), different storage layouts (row vs columnar) and resource contention; analytics queries can starve transactional traffic. Replicate or stream data (CDC) to a warehouse.
- **Q: How do you serve private files securely?**
  A: Keep the bucket private; issue short-lived signed URLs after an authorisation check; or serve through a CDN with signed cookies/URLs.

**Pitfalls:** proxying large uploads through app servers; no lifecycle policy (cost creep); public buckets.

---

## 7. Authentication, authorisation and security basics

**Concepts**
- **AuthN** (who are you) vs **AuthZ** (what may you do). **Sessions** (server-side state, cookie id) vs **tokens** (JWT: signed claims, stateless, hard to revoke → short expiry + refresh tokens). **OAuth 2.0** (delegated authorisation: authorisation code + PKCE for apps), **OIDC** (identity layer on OAuth), **SAML** (enterprise SSO), **API keys** (service identification; hash at rest), **mTLS** (service-to-service identity).
- **AuthZ models:** RBAC (roles), ABAC (attributes/policies), ReBAC (relationships, e.g. Google Zanzibar). Enforce on the server, at every layer; deny by default; least privilege.
- **Password storage:** salted slow hashes (Argon2id, bcrypt, scrypt); never encrypt, never plain hash.
- **Encryption:** TLS in transit; at rest with managed keys (KMS) and envelope encryption; secrets in a vault, never in code or logs.
- **OWASP essentials:** injection (parameterised queries), XSS (output encoding, CSP), CSRF (SameSite cookies, tokens), SSRF, broken access control (IDOR: check ownership on every object access), security misconfiguration, vulnerable dependencies.
- **Rate limiting and abuse controls**, audit logs, secure defaults, defence in depth.

**Question bank**
- **Q: JWT or server sessions?**
  A: Sessions are simple and revocable instantly but need shared state; JWTs scale statelessly across services but cannot be revoked before expiry, so keep them short-lived (5–15 min) with rotating refresh tokens and a deny-list for emergencies. Many systems use opaque tokens introspected by a gateway for sensitive flows.
- **Q: Explain OAuth 2.0 authorisation code flow with PKCE.**
  A: App redirects the user to the provider with a code challenge; user authenticates and consents; provider returns an authorisation code; the app exchanges the code plus the code verifier for tokens at the token endpoint, so an intercepted code is useless. Use for SPAs and mobile instead of implicit flow.
- **Q: What is an IDOR and how do you prevent it?**
  A: Insecure Direct Object Reference: `/orders/123` returns another user's order because only authentication was checked. Always authorise the specific object against the caller's identity and tenant server-side, and prefer returning 404 for unauthorised objects to avoid existence leaks.
- **Q: How do you store passwords?**
  A: Argon2id (or bcrypt) with a per-user salt and tuned work factor, optional pepper in a secret store; enforce breach-password checks and MFA.
- **Q: How do services authenticate each other?**
  A: mTLS with a service mesh or short-lived workload identities (SPIFFE/IAM roles), plus signed service tokens carrying the end-user context for downstream authorisation.
- **Q: How do you protect against CSRF with cookie-based sessions?**
  A: `SameSite=Lax/Strict` cookies, anti-CSRF tokens for state-changing requests, check `Origin` headers, and don't use GET for mutations.

**Pitfalls:** authorising in the UI only; long-lived JWTs; secrets in env files committed to git; logging tokens or PII.

---

# STAGE 2 — INTERMEDIATE

## 8. Replication

**Concepts**
- **Why:** availability (survive node loss), read scaling, geographic latency, backups/analytics offload.
- **Topologies:** **single-leader** (all writes to primary, followers replicate; simple, most common), **multi-leader** (writes in several places; needs conflict resolution; multi-region, offline clients), **leaderless** (Dynamo/Cassandra: write to N replicas, quorum reads/writes).
- **Sync vs async:** synchronous = no data loss on failover but latency and availability cost; asynchronous = fast but **replication lag** and possible loss of the last writes on failover; **semi-sync** = one sync follower, rest async.
- **Replication lag anomalies and fixes:** *read-your-writes* (route a user's reads to the leader for a while after their write, or track the write's LSN/timestamp), *monotonic reads* (pin a user to one replica), *consistent prefix reads*.
- **Failover:** detect (heartbeat), elect/promote the most up-to-date replica, repoint clients, fence the old primary (avoid **split brain**), reconcile lost writes. Automated tools: Patroni, Orchestrator, managed services.
- **Quorums:** with N replicas, W write acks, R read acks, **R + W > N** ensures overlap (a read sees the latest acknowledged write, absent sloppy quorums/concurrent writes). Typical N=3, W=2, R=2.
- **Log shipping:** WAL/binlog streaming (physical or logical); **CDC** (Debezium) turns the log into an event stream.

**Question bank**
- **Q: A user updates their profile and immediately sees the old data. Why, and how do you fix it?**
  A: Read hit a lagging replica. Fix with read-your-writes: send that user's reads to the primary for a short window after writes, or compare the replica's applied position to the user's last write token and fall back to the primary if behind.
- **Q: Sync or async replication?**
  A: Async for most workloads (accept small loss window / RPO > 0); semi-sync when you must not lose acknowledged commits but can tolerate one sync hop; full sync across regions is usually too slow.
- **Q: What is split brain and how do you prevent it?**
  A: Two nodes both believe they are primary and accept writes, diverging data. Prevent with a consensus-based leader election/lease, quorum requirement (majority), and **fencing** (revoke the old leader's storage/network access or reject its writes via fencing tokens).
- **Q: How do quorums work in a leaderless store?**
  A: Writes go to N replicas and succeed after W acks; reads query R replicas and return the newest version. If R+W>N, read and write sets intersect. W=1,R=N favours write availability; W=N,R=1 favours read speed. Read repair and anti-entropy fix stale replicas.
- **Q: When would you choose multi-leader?**
  A: Multi-region writes with local latency, offline-capable clients, or collaborative editing. Accept conflict handling complexity (LWW, CRDTs, app-level merge) and avoid it if a single leader per region/shard suffices.
- **Q: How do you do a zero-downtime primary failover?**
  A: Automated health detection, promote the most caught-up replica, update the endpoint (DNS with low TTL, proxy, or virtual IP), drain/retry connections in clients, and verify no writes land on the old primary.

**Pitfalls:** assuming replicas are instantly consistent; promoting a replica without fencing; counting replicas as backups (a bad `DELETE` replicates too; you still need point-in-time recovery).

---

## 9. Partitioning (sharding) and consistent hashing

**Concepts**
- **Partition when** a single node can't hold the data or handle the writes. Prefer vertical scaling, indexes, caching and read replicas first.
- **Schemes:** **range** (good for scans, risks hot spots like time-ordered keys), **hash** (even distribution, loses range queries), **directory/lookup** (flexible, extra hop and SPOF risk), **geo**.
- **Shard key choice** is the decision that matters: high cardinality, even access, aligned with the dominant query (so one request hits one shard). Bad keys: monotonic timestamps, low-cardinality fields, celebrity IDs.
- **Consistent hashing:** nodes and keys hashed onto a ring; a key belongs to the next node clockwise; adding/removing a node moves only ~1/N of keys; **virtual nodes** smooth load and allow heterogeneous capacity. (Alternative: fixed number of hash slots, e.g. Redis Cluster's 16,384, remapped to nodes.)
- **Cross-shard concerns:** no cross-shard joins/transactions → denormalise, scatter-gather, or use sagas; global secondary indexes (local vs global index trade-off); unique constraints across shards need a coordinator or the key in the shard key.
- **Rebalancing/resharding:** many small logical shards mapped to few nodes (move whole shards), double-writes + backfill, online split of hot ranges.
- **Hot spots:** one hot key/shard → salting/suffixing, splitting, caching, separate treatment for celebrities.

```ts
// Consistent hash ring with virtual nodes (sketch)
import { createHash } from "node:crypto";
const h = (s: string) => parseInt(createHash("md5").update(s).digest("hex").slice(0, 8), 16);

class Ring {
  private points: { pos: number; node: string }[] = [];
  constructor(nodes: string[], private vnodes = 150) { nodes.forEach((n) => this.add(n)); }
  add(node: string) {
    for (let i = 0; i < this.vnodes; i++) this.points.push({ pos: h(`${node}#${i}`), node });
    this.points.sort((a, b) => a.pos - b.pos);
  }
  remove(node: string) { this.points = this.points.filter((p) => p.node !== node); }
  get(key: string): string {
    const pos = h(key);
    let lo = 0, hi = this.points.length;           // first point with pos >= key hash
    while (lo < hi) { const m = (lo + hi) >> 1; if (this.points[m].pos < pos) lo = m + 1; else hi = m; }
    return this.points[lo % this.points.length].node; // wrap around the ring
  }
}
```

**Question bank**
- **Q: How do you choose a shard key for a multi-tenant SaaS? For a chat app? For a social feed?**
  A: SaaS: `tenant_id` (queries are tenant-scoped; watch for giant tenants, which get dedicated shards). Chat: `conversation_id` (messages for a conversation co-located and ordered). Feed: `user_id` for timelines, `post_id`/author for posts; fan-out handled asynchronously.
- **Q: Why consistent hashing instead of `hash(key) % N`?**
  A: Changing N remaps almost every key (cache wipe-out, mass data movement). On a ring only the keys between the changed node and its neighbour move (~1/N).
- **Q: What problems does sharding create?**
  A: Cross-shard joins/transactions, rebalancing, hot shards, operational complexity, global uniqueness and secondary indexes. Mitigate with careful shard keys, denormalisation, sagas, and a routing layer.
- **Q: A shard is hot because one customer is huge. What do you do?**
  A: Isolate that tenant onto its own shard/cluster, split by a secondary dimension (tenant + hash of entity), cache aggressively, and add per-tenant limits.
- **Q: Range vs hash partitioning?**
  A: Range supports efficient range scans and ordered data but risks hot spots on sequential keys; hash gives uniform load but needs scatter-gather for ranges. Hybrid: hash prefix + range within it (compound keys).
- **Q: How do you reshard without downtime?**
  A: Use many virtual shards from the start; create the new layout, dual-write and backfill, verify, switch reads, then writes, then clean up; keep the router as the single place where the mapping changes.

**Pitfalls:** sharding too early; time-based shard keys; forgetting global uniqueness; no plan for resharding.

---

## 10. Messaging and event-driven design

**Concepts**
- **Why queues:** decouple producers/consumers, absorb spikes (load levelling), enable retries and async work, fan-out.
- **Queue vs log:** **queue** (SQS/RabbitMQ): message deleted after ack, competing consumers, per-message retries/DLQ. **Log** (Kafka/Kinesis/Pulsar): append-only partitions, consumers track offsets, replay, ordering per partition, huge throughput.
- **Pub/sub topics**, **consumer groups** (each partition → one consumer in the group), **partition key** preserves per-key order.
- **Delivery semantics:** at-most-once (may lose), **at-least-once** (may duplicate; the practical default), exactly-once *effect* = at-least-once + **idempotent consumers** (or transactional writes of output + offsets within one system).
- **Idempotency patterns:** dedupe table keyed by message ID, upserts, natural idempotency (`SET`), versioned writes.
- **Outbox pattern:** write the business change and the event to an `outbox` table in **one DB transaction**; a relay publishes to the broker, avoiding dual-write inconsistency. **Inbox/dedupe** on the consumer.
- **Failure handling:** retries with exponential backoff + jitter, **dead-letter queue**, poison-message handling, back-pressure, visibility timeout.
- **Event-driven styles:** event notification, event-carried state transfer, **event sourcing** (state = fold of events; audit, replay; complexity), **CQRS** (separate write and read models).
- **Ordering:** global ordering is expensive; guarantee per-key/partition only.

**Question bank**
- **Q: Kafka or SQS/RabbitMQ?**
  A: Kafka for high-throughput streams, replay, multiple independent consumer groups, ordering per key, stream processing. SQS/RabbitMQ for task queues with per-message acks, delayed delivery, simpler operations and priority/routing needs.
- **Q: How do you get "exactly-once" processing?**
  A: You can't guarantee it end-to-end across arbitrary systems; achieve exactly-once *effect* with at-least-once delivery plus idempotent processing (dedupe by message ID in the same transaction as the side effect), or Kafka transactions for Kafka-to-Kafka pipelines.
- **Q: What problem does the outbox pattern solve?**
  A: Dual writes: saving to the DB then publishing to the broker can fail between the two, losing or phantom-publishing events. The outbox commits event and data atomically; a poller/CDC reliably publishes, giving at-least-once delivery.
- **Q: A consumer is slower than the producer. What happens and what do you do?**
  A: Queue depth/lag grows. Scale consumers (up to partition count), batch processing, optimise the handler, apply back-pressure/rate limits upstream, shed or prioritise low-value messages, alert on lag.
- **Q: How do you handle poison messages?**
  A: Bounded retries with backoff, then route to a DLQ with context for inspection/replay; make handlers tolerant to schema variants; alert on DLQ growth.
- **Q: How does Kafka preserve ordering and scale?**
  A: Ordering within a partition; producers choose the partition by key; throughput scales with partitions; each consumer in a group owns a subset of partitions; replication with leader/ISR gives durability.
- **Q: When is event sourcing worth it?**
  A: Audit-heavy or temporal domains (finance, ledgers), need to rebuild projections or time-travel; not worth the complexity for simple CRUD. Mitigate costs with snapshots and schema versioning for events.

**Pitfalls:** assuming messages arrive once and in order; dual writes; unbounded retries; huge messages (store payload in object storage, send a reference).

---

## 11. Microservices, service communication and resilience

**Concepts**
- **Monolith vs microservices:** start with a modular monolith; split by business capability/bounded context when teams, scaling or deploy independence demand it. Distributed systems cost: network failures, latency, consistency, observability, versioning.
- **Communication:** synchronous (REST/gRPC; simple, couples availability) vs asynchronous (events/queues; decoupled, eventual consistency).
- **Infrastructure patterns:** **API gateway** (single entry: auth, routing, throttling), **service discovery** (registry/DNS/Kubernetes), **service mesh** (sidecar: mTLS, retries, telemetry), **BFF** (backend-for-frontend), config service, feature flags.
- **Resilience patterns:** **timeouts everywhere**, **retries** (only idempotent calls, exponential backoff + jitter, retry budgets to avoid retry storms), **circuit breaker** (open after failures, half-open probes), **bulkheads** (isolate resource pools), **rate limiting**, **load shedding**, **graceful degradation/fallbacks**, **hedged requests** (carefully).
- **Sagas** for multi-service workflows: sequence of local transactions with compensating actions; **orchestration** (central coordinator) vs **choreography** (events). Avoid distributed 2PC across services.
- **Data ownership:** each service owns its data; no shared databases; integration via APIs/events.
- **Backward compatibility and contracts:** consumer-driven contract tests, schema registries, additive changes.
- **Deployment safety:** canary, blue/green, feature flags, automated rollback.

**Question bank**
- **Q: When would you NOT use microservices?**
  A: Small team/early product, unclear domain boundaries, low scale: operational overhead (deploys, observability, network failures) outweighs the benefits. Prefer a modular monolith with clear module boundaries you can split later.
- **Q: A downstream service is slow. How do you prevent a cascading failure?**
  A: Strict timeouts, circuit breaker with fallback, bulkheads so a slow dependency can't exhaust shared thread pools, bounded queues with load shedding, retry budgets (not unlimited retries), and caching or stale data as fallback.
- **Q: Retries made the outage worse. Why?**
  A: Retry storms: clients multiply load on a struggling service. Use exponential backoff with jitter, cap attempts, retry only idempotent and retryable errors, have the server signal overload (429/503 + Retry-After), and use circuit breakers.
- **Q: How do you implement a distributed workflow (order → payment → inventory → shipping)?**
  A: A saga: each step is a local transaction with a compensating action (refund, release stock). Use orchestration (e.g. Temporal/Step Functions) for visibility, or choreography via events for simple flows. Make every step idempotent and persist saga state.
- **Q: How do you handle a request that spans services but needs tracing?**
  A: Propagate a trace/correlation ID (W3C Trace Context) through every call and message; emit spans (OpenTelemetry); log with the ID; sample intelligently.
- **Q: Service mesh: what does it give you and cost you?**
  A: Gives mTLS, retries/timeouts policy, traffic splitting and uniform telemetry without app changes; costs added latency, resource overhead and operational complexity. Worth it with many services and strict security needs.
- **Q: How do you do API versioning between services?**
  A: Expand/contract: add new fields/endpoints, migrate consumers, then remove old; contract tests in CI; schema registry with compatibility checks for events.

**Pitfalls:** distributed monolith (services that must deploy together); shared database; synchronous chains five calls deep; retrying non-idempotent calls.

---

## 12. Consistency, CAP/PACELC and distributed transactions

**Concepts**
- **CAP:** under a network **P**artition you must choose **C**onsistency (refuse some requests) or **A**vailability (serve possibly stale data). Partitions will happen, so the real choice is during partitions. **PACELC:** *else* (no partition) you still trade **L**atency vs **C**onsistency.
- **Consistency models (strong → weak):** **linearizable** (behaves like one copy; real-time order) → **sequential** → **causal** (respects cause–effect) → **read-your-writes / monotonic reads** (session guarantees) → **eventual**. Stronger = more coordination = more latency.
- **Isolation vs consistency:** ACID "C" and CAP "C" differ; serializability is a transaction property, linearizability a single-object recency property.
- **Distributed transactions:** **2PC** (prepare/commit by a coordinator; blocking if the coordinator fails; used inside databases like Spanner/CockroachDB with replicated participants), **3PC** (rarely used), **sagas** (eventual, compensations), **TCC** (try-confirm-cancel), idempotent steps.
- **Time and ordering:** physical clocks skew; **Lamport clocks** (logical ordering), **vector clocks** (detect concurrency), **hybrid logical clocks**, TrueTime (bounded uncertainty).
- **Conflict resolution:** last-write-wins (loses data), merge functions, **CRDTs**, app-level resolution, version vectors.
- **Idempotency + deduplication** are the glue of eventual consistency.

**Question bank**
- **Q: Explain CAP with an example.**
  A: Two data centres lose connectivity. A CP system (e.g. etcd, a bank ledger) stops accepting writes on the minority side to avoid divergence; an AP system (e.g. Cassandra at low consistency, DNS) keeps serving both sides and reconciles later. Say which data in your design needs which.
- **Q: What does PACELC add?**
  A: Even without partitions, replication forces a latency vs consistency choice (waiting for more replicas costs latency). E.g. Dynamo/Cassandra: PA/EL; Spanner: PC/EC.
- **Q: Linearizability vs serializability?**
  A: Linearizability: single-object, recency/real-time guarantee. Serializability: multi-object transactions behave as if executed one at a time (no real-time requirement). Strict serializability = both (Spanner).
- **Q: How would you handle money transfer between accounts in different shards?**
  A: Avoid 2PC across services if possible: use a ledger with double-entry records in one shard per transfer, or a saga with a pending state: debit with hold → credit → confirm; idempotency keys and reconciliation catch failures. Where the DB supports it (Spanner/CockroachDB), use its distributed transactions.
- **Q: Why can't you trust timestamps for ordering events across machines?**
  A: Clock skew and drift (NTP gives ms-level accuracy at best; leap seconds, VM pauses). Use logical/hybrid clocks, sequence numbers from a single writer per entity, or consensus ordering.
- **Q: LWW is easy but what does it cost?**
  A: Silent data loss for concurrent updates and dependence on clocks. Use CRDTs or version vectors with merge logic when losing an update is unacceptable.
- **Q: Which consistency does a shopping cart need? A bank balance? A like counter?**
  A: Cart: eventual with merge (Dynamo's classic example: add-wins union). Balance: strong (serializable) on the account. Like counter: eventual, approximate counters are fine.

**Pitfalls:** saying "we'll use CAP's CA" (not a real option in distributed systems); equating eventual consistency with "inconsistent"; choosing strong consistency globally "to be safe".

---

## 13. Search, indexing and specialised data structures

**Concepts**
- **Inverted index:** term → posting list of documents (with positions/frequencies); the core of full-text search. Ranking: TF-IDF, **BM25**; filters, facets, analysers (tokenise, lowercase, stem, stopwords, n-grams for autocomplete).
- **Elasticsearch/OpenSearch/Solr:** distributed Lucene; documents → **shards** (+ replicas); near-real-time (refresh interval ~1 s); not a system of record. Keep source of truth in a DB and index asynchronously (CDC/queue), with reindex strategy (aliases).
- **Vector search:** embeddings + ANN (HNSW, IVF-PQ); hybrid with BM25 and rerank.
- **Bloom filter:** probabilistic set, no false negatives, tunable false positives; avoids lookups for absent keys (cache penetration, LSM reads, crawler dedupe). Space ≈ 10 bits/element for ~1% FP.
- **Count-Min Sketch** (approximate frequencies, heavy hitters), **HyperLogLog** (approximate distinct count in ~12 KB), **t-digest/HDR** (percentiles), **reservoir sampling**.
- **Trie / radix tree** (prefix search, autocomplete), **geohash / quadtree / S2 / H3** (spatial), **skip list** (Redis sorted sets), **LSM-tree**, **B+ tree**, **Merkle tree** (anti-entropy), **consistent hashing**, **timing wheel** (many timers).
- **Time-series:** append-heavy, downsampling/rollups, retention policies, high-cardinality traps.

**Question bank**
- **Q: How does a full-text search engine work?**
  A: Documents are analysed into terms; an inverted index maps terms → posting lists; a query is analysed the same way, posting lists are intersected/unioned, and results are scored (BM25). The index is split into shards for parallelism and replicated for availability.
- **Q: How do you keep Elasticsearch in sync with the primary DB?**
  A: Treat ES as a derived view: write to the DB, emit events through an outbox/CDC to a queue, and have an indexer upsert documents idempotently (using version numbers to ignore stale updates). Support full reindex into a new index with an alias swap.
- **Q: How would you count unique visitors across billions of events?**
  A: HyperLogLog (≈ 0.8% error with 12 KB per counter), mergeable across shards/time windows; use exact sets only for small cardinalities.
- **Q: How do you find the top-K trending items in a stream?**
  A: Count-Min Sketch + min-heap (or Space-Saving algorithm) per window, merge sketches across nodes; decay old counts to reflect recency.
- **Q: Where do Bloom filters help in system design?**
  A: Cheap "definitely not present" checks: LSM-tree SSTable lookups, cache penetration protection, crawler seen-URL sets, username availability pre-check. Accept occasional false positives (extra lookup), never false negatives.
- **Q: How would you find nearby drivers within 2 km?**
  A: Spatial index (geohash/S2/H3 cells): query the user's cell and neighbours, filter by exact distance; shard by region; keep live positions in memory with TTL.
- **Q: Autocomplete for 100M queries?**
  A: Trie with top-K per node built offline from logs, served from memory/cache, sharded by prefix, with a small real-time overlay for trends.

**Pitfalls:** using the search engine as the primary store; ignoring analyser/language issues; exact counting at huge scale where an approximation is acceptable.

---

## 14. Observability, reliability engineering and deployment

**Concepts**
- **Three pillars:** **metrics** (aggregated numbers; RED: rate/errors/duration for services; USE: utilisation/saturation/errors for resources), **logs** (structured JSON, correlation IDs, no PII), **traces** (request path across services; sampling). Add **profiling** and **synthetic checks**.
- **Golden signals:** latency, traffic, errors, saturation.
- **Alerting:** alert on symptoms (user-facing SLO burn), not causes; multi-window burn-rate alerts; reduce noise; runbooks; on-call.
- **Deployment strategies:** rolling, **blue/green**, **canary** (small % first, auto-rollback on SLO regression), **feature flags** (decouple deploy from release), dark launches, shadow traffic.
- **Database changes:** **expand/contract** migrations (add nullable column → dual write → backfill → switch reads → drop), never a breaking migration in one step.
- **Reliability practices:** health checks (liveness vs readiness), graceful shutdown, autoscaling (on queue depth/latency, not just CPU), capacity headroom, **chaos engineering/game days**, **postmortems** (blameless), incident roles, **error budgets** gating releases.
- **Infra as code**, immutable infrastructure, containers/Kubernetes basics (pods, deployments, services, HPA), CI/CD pipelines with automated tests and security scans.
- **Backups:** 3-2-1 rule, **test restores**, point-in-time recovery; **RPO** (max data loss) and **RTO** (max downtime) drive the design.

**Question bank**
- **Q: What would you monitor for a checkout service?**
  A: SLIs: success rate and p99 latency of checkout; golden signals per dependency (payment provider, DB); saturation (DB connections, queue lag); business metrics (orders/min vs baseline). Alert on SLO burn rate; dashboards per dependency; traces for slow requests.
- **Q: How do you roll out a risky change safely?**
  A: Feature flag + canary at 1% → 5% → 25% with automated comparison of error rate/latency to baseline, instant rollback via flag, shadow traffic for validation, expand/contract for data changes, and a clear abort criterion.
- **Q: Liveness vs readiness probes?**
  A: Liveness: "restart me if I'm wedged." Readiness: "send me traffic only when dependencies are ready." Failing readiness removes the pod from the load balancer without killing it; don't put dependency checks in liveness (causes restart storms).
- **Q: Production is down. What do you do in the first 10 minutes?**
  A: Declare incident and roles, assess impact via SLO dashboards, mitigate before diagnosing (roll back, flip a flag, fail over, shed load), communicate status, preserve evidence, then root-cause and write a blameless postmortem with action items.
- **Q: How do you do a database schema change without downtime?**
  A: Expand/contract: add the new column/table (backwards compatible), deploy code writing both, backfill in batches, switch reads, remove old writes, then drop the old column in a later release.
- **Q: What are RPO and RTO and how do they influence design?**
  A: RPO = acceptable data loss window; RTO = acceptable downtime. Tight RPO → synchronous/near-sync replication, frequent snapshots, PITR; tight RTO → warm standby/active-active and automated failover; looser targets allow cheaper backup-restore.
- **Q: How do you control observability cost?**
  A: Sample traces (tail-based for errors/slow), limit metric cardinality (no user IDs as labels), tiered log retention, drop debug logs in prod, and aggregate at the edge.

**Pitfalls:** alerting on CPU instead of user impact; logging PII; never testing restores; high-cardinality labels exploding metric storage.

---

# STAGE 3 — ADVANCED

## 15. Consensus, coordination and distributed locking

**Concepts**
- **Consensus problem:** nodes agree on a value/sequence despite crashes and delays. Needed for leader election, replicated logs, configuration, locks, metadata.
- **Raft** (understandable): leader election (terms, randomised timeouts, majority votes), **log replication** (leader appends, replicates to followers, commits on majority ack), safety (only a candidate with an up-to-date log can win). **Multi-Paxos / Zab (ZooKeeper)** are equivalents. Tolerates **f failures with 2f+1 nodes** (3 nodes → 1 failure, 5 → 2).
- **FLP impossibility:** no deterministic consensus is guaranteed to terminate in a fully asynchronous system with even one crash; practical protocols use timeouts/randomness.
- **Coordination services:** etcd, ZooKeeper, Consul: small, strongly consistent KV with **watches, leases/ephemeral nodes**. Used for config, service discovery, leader election, locks. They are not high-throughput data stores.
- **Distributed locks:** lease-based locks with TTL; **fencing tokens** (monotonic number returned with each grant; the protected resource rejects older tokens) are what make them safe against paused clients (GC pause, VM freeze). Redis `SET NX PX` is fine for efficiency locks (duplicate work is acceptable), **not** for correctness locks without fencing. Redlock is contested for safety.
- **Leader election patterns:** lease in etcd/ZooKeeper, DB row lease, Kubernetes lease objects. Always handle leadership loss mid-operation.
- **Failure detectors:** heartbeats, phi-accrual; **gossip** (SWIM) for scalable membership.
- **Byzantine fault tolerance** (PBFT, blockchains) handles malicious nodes at higher cost; irrelevant to most internal systems.
- **Time:** lease safety depends on bounded clock drift; consensus systems use logical terms/epochs rather than wall clocks.

**Question bank**
- **Q: Explain Raft in two minutes.**
  A: One elected leader serializes writes into a replicated log. Followers have randomised election timeouts; if no heartbeat, a follower becomes a candidate, increments the term and requests votes; a majority wins. The leader replicates entries and marks them committed when a majority has them; committed entries are applied to the state machine. A candidate must have a log at least as up to date as the voters', so committed entries are never lost. Minority partitions can't elect a leader or commit.
- **Q: Why odd cluster sizes?**
  A: Majority quorum is ⌊n/2⌋+1: 4 nodes tolerate 1 failure (same as 3) but cost more and make split votes likelier. 5 nodes tolerate 2.
- **Q: How do you implement a distributed lock safely?**
  A: Acquire via a consensus store (etcd/ZooKeeper) with a lease; return a fencing token; the resource (DB, storage) validates and rejects stale tokens; renew the lease via heartbeat; assume the holder can be paused and design the resource to be safe regardless.
- **Q: Do you need a lock at all?**
  A: Often no: use a DB conditional update / compare-and-swap, a unique constraint, or a single-writer partition (queue keyed by entity) to serialize work. Locks are a last resort.
- **Q: How does leader election work in a service with N workers where only one should run a cron job?**
  A: Each instance tries to create an ephemeral key/lease; the winner runs, others watch the key; on lease expiry another wins. Jobs must be idempotent because two leaders may briefly overlap.
- **Q: What does ZooKeeper/etcd give you that Redis doesn't?**
  A: Linearizable, consensus-replicated state with ordered watches and session/lease semantics; Redis replication is asynchronous, so failover can lose acknowledged writes and two nodes may both believe they hold a lock.
- **Q: What happens to a Raft cluster during a network partition?**
  A: The side with a majority continues (re-electing if needed); the minority side can't commit writes (CP) and reads from it may be stale unless routed through the leader/ReadIndex. When healed, minority followers truncate conflicting uncommitted entries.

**Pitfalls:** relying on wall-clock TTL alone for correctness; using Redis locks for financial invariants; putting high-volume data into ZooKeeper.

---

## 16. Storage-engine internals and distributed databases

**Concepts**
- **B-tree/B+tree:** in-place updates on fixed pages, great reads and range scans, write amplification, WAL for crash safety. Used by Postgres, MySQL/InnoDB.
- **LSM-tree:** writes go to **WAL + memtable**, flushed as immutable sorted **SSTables**, merged by **compaction** (leveled vs size-tiered); reads check memtable then SSTables with **Bloom filters** and indexes; excellent write throughput, read/space/write amplification trade-offs. Used by Cassandra, RocksDB, LevelDB, HBase.
- **WAL (write-ahead log):** durability and recovery; **fsync** policy trades durability vs throughput; **group commit**.
- **MVCC:** versioned rows, snapshot reads without locks; vacuum/garbage collection cost.
- **Dynamo-style systems:** consistent hashing, N/W/R quorums, vector clocks/LWW, hinted handoff, read repair, Merkle-tree anti-entropy, gossip membership, sloppy quorums.
- **Spanner/CockroachDB-style (NewSQL):** range-partitioned, each range a Raft group, distributed transactions via 2PC over Raft groups, **TrueTime** (bounded clock uncertainty + commit wait) or HLC for ordering, follower/stale reads, geo-partitioning.
- **Bigtable/HBase:** sorted tablets, row-key design is everything (avoid hot-spotting with salting/reversed timestamps).
- **Column stores & OLAP:** columnar layout, compression, vectorised execution, partition pruning, materialised views.
- **Index types in distributed stores:** local secondary indexes (scatter-gather reads) vs global (cross-shard writes, eventual consistency).
- **Caching layers inside the DB:** buffer pool, OS page cache; why "RAM is your index".

**Question bank**
- **Q: B-tree vs LSM-tree: when do you choose each?**
  A: B-tree for read-heavy/mixed workloads, predictable latency, transactions and range scans; LSM for write-heavy, ingest-heavy workloads (logs, time-series, messaging metadata) accepting compaction overhead and higher read amplification. Bloom filters and block caches mitigate LSM reads.
- **Q: What is write amplification and why does it matter?**
  A: Bytes physically written per byte logically written. B-trees rewrite pages and logs; LSM rewrites data repeatedly during compaction. It consumes SSD lifespan and I/O bandwidth, and bounds sustainable write throughput.
- **Q: How does a database guarantee durability after a crash?**
  A: Changes are appended to the WAL and fsynced before commit is acknowledged; on restart, replay committed log records to redo and roll back uncommitted ones (ARIES-style). Replication ships the same log.
- **Q: Walk me through how Dynamo/Cassandra handles a write when a replica is down.**
  A: The coordinator writes to the healthy replicas; with a sloppy quorum it stores a hint on another node for the down replica (hinted handoff) and replays it on recovery; read repair and Merkle-tree anti-entropy fix remaining divergence. Write succeeds if W acks were collected.
- **Q: How does Spanner get externally consistent transactions across continents?**
  A: Data is split into Paxos-replicated groups; multi-group transactions use 2PC across group leaders; TrueTime exposes a time interval [earliest, latest]; a transaction picks a commit timestamp and waits out the uncertainty (commit wait, ~ms) so timestamps order real-time. Read-only snapshot reads need no locks.
- **Q: Design a row key for time-series data in Bigtable/HBase.**
  A: Avoid pure timestamp prefixes (write hot spot). Use `deviceId#reverseTimestamp` or `hash(deviceId) % buckets # deviceId # time`, enabling per-device range scans while spreading writes across tablets.
- **Q: Why do LSM databases need compaction and what can go wrong?**
  A: To merge SSTables, drop overwritten/deleted data and bound read amplification. Compaction storms can saturate disk and spike latency; tune strategy, throttle compaction I/O, and watch tombstone buildup.

**Pitfalls:** treating "NoSQL" as one thing; ignoring compaction and tombstones; picking a DB by benchmark headlines instead of the workload.

---

## 17. Stream processing and data pipelines

**Concepts**
- **Batch vs stream:** batch (Spark, warehouse jobs) = high throughput, high latency; stream (Flink, Kafka Streams, Spark Structured Streaming) = low latency, stateful, continuous. **Lambda** (batch + speed layers; duplicate logic) vs **Kappa** (single stream pipeline with replay).
- **Time semantics:** **event time** vs **processing time**; **watermarks** (how long to wait for late events), **allowed lateness**; **windows** (tumbling, sliding, session).
- **State & fault tolerance:** keyed state, checkpoints/snapshots (Chandy–Lamport style barriers in Flink), exactly-once state semantics, changelog topics, state rebuilds from replay.
- **Delivery vs processing guarantees:** end-to-end exactly-once requires replayable sources, transactional/idempotent sinks.
- **CDC (change data capture):** stream the DB log (Debezium) to Kafka for search indexing, caches, analytics, microservice integration; avoids dual writes.
- **Schema management:** Avro/Protobuf + schema registry, compatibility rules (backward/forward/full).
- **Data lake/lakehouse:** object storage + open table formats (Iceberg/Delta/Hudi) with ACID snapshots, time travel, compaction; medallion layers (bronze/silver/gold).
- **Orchestration:** Airflow/Dagster/Temporal: DAGs, retries, backfills, SLAs; idempotent, partitioned tasks (write by partition, overwrite not append).
- **Data quality:** contracts, validation, lineage, anomaly detection.
- **Backpressure** in pipelines: bounded buffers, pull-based consumers, autoscaling on lag.

**Question bank**
- **Q: Event time vs processing time, and why does it matter?**
  A: Event time is when it happened; processing time when we saw it. Mobile/offline/network delays reorder events, so correct windows (per-minute revenue) need event-time with watermarks; otherwise results shift with system lag.
- **Q: What is a watermark and what are the trade-offs?**
  A: A heuristic "no more events older than T are expected." A tight watermark gives low latency but drops/late-handles more events; a loose one is accurate but delays results and grows state. Late data can update results (retractions) or go to a side output.
- **Q: How do you get exactly-once results in a streaming pipeline?**
  A: Replayable source (Kafka offsets), checkpointed operator state, and an idempotent or transactional sink (two-phase commit sink or upserts keyed by deterministic IDs). On failure, restore the last checkpoint and replay.
- **Q: Lambda or Kappa?**
  A: Kappa when the stream engine can reprocess from the log and you want one code path; Lambda when batch logic is genuinely different or historic corrections are heavy. Modern lakehouse table formats blur the line.
- **Q: Design a pipeline that keeps a search index and a warehouse in sync with an OLTP DB.**
  A: Debezium CDC → Kafka (keyed by primary key) → consumers: indexer upserts to Elasticsearch with version checks; sink connector writes to the warehouse/lake (Iceberg) with merge-on-read; handle schema evolution via a registry, deletes via tombstones, and backfills via snapshot + log catch-up.
- **Q: A backfill must reprocess 90 days. What breaks and how do you design for it?**
  A: Non-idempotent writes, ordering assumptions, rate limits on downstreams, resource contention with live traffic. Make jobs partitioned and idempotent (overwrite partition), throttle, run in an isolated environment, and verify with row counts/checksums.
- **Q: How do you detect a silent data-quality issue?**
  A: Volume/freshness/null-rate/distribution checks per table, schema contracts, reconciliation against the source, lineage to find upstream causes, alerts on anomalies.

**Pitfalls:** processing-time windows for business metrics; non-idempotent sinks; unbounded state; no plan for schema evolution.

---

## 18. Multi-region architecture, disaster recovery and conflict resolution

**Concepts**
- **Why multi-region:** latency to users, regional failure tolerance, data residency/compliance.
- **Topologies:** **active-passive** (warm standby, simpler, RTO minutes, wasted capacity), **active-active** (all regions serve; best latency/availability; hard data consistency), **pilot light** (minimal core running, scale on failover), **cell-based / geo-partitioned** (each user homed to a region; cross-region only for rare cases).
- **Data strategies:** single-writer per entity (**home region**) with async replication; multi-leader with conflict resolution; globally consistent DB (Spanner/CockroachDB; pay cross-region commit latency); per-region partitions for residency.
- **Conflict resolution:** LWW (simple, lossy), **version vectors**, application merge, **CRDTs** (G-counter, PN-counter, OR-Set, LWW-register, sequence CRDTs for text), operational transformation.
- **Traffic routing:** GSLB, latency-based DNS, anycast, health-based failover; DNS TTL and client caching limit failover speed.
- **DR concepts:** **RPO/RTO** tiers (backup & restore → pilot light → warm standby → multi-site active-active); backups across regions/accounts, immutable backups (ransomware), regular **failover drills**.
- **Blast-radius reduction:** **cells/shuffle sharding**, regional independence (no hidden global dependencies like a single control plane, auth or config store), static stability (keep working when the control plane is down).
- **Cross-region costs:** egress fees, replication lag, 100–200 ms RTTs.

**Question bank**
- **Q: How would you design for a full region outage?**
  A: Stateless tier deployed in ≥ 2 regions; data replicated (async or consensus) with defined RPO; health-checked global routing; runbook/automation for promotion; static stability so surviving regions don't depend on the failed region's control plane; regular game days. State the RPO/RTO achieved.
- **Q: Active-active vs active-passive?**
  A: Active-passive if you can tolerate minutes of RTO and want simple consistency. Active-active when latency or availability demands it and you can partition data by home region or resolve conflicts; more cost and complexity, and it must be tested constantly.
- **Q: Two users edit the same record in different regions at the same time. What happens?**
  A: With a single home region per record, one write is forwarded or rejected cleanly. With multi-leader, conflicts must be detected (version vectors) and resolved: LWW (lossy), merge by field, CRDT, or surface to the user.
- **Q: What is a CRDT and when would you use it?**
  A: A data type whose replicas converge without coordination because merge is commutative, associative and idempotent. Use for counters, sets, collaborative text, presence, offline-first sync. Cost: metadata growth/tombstones and limited invariants (can't enforce "balance ≥ 0").
- **Q: How do you meet data residency (EU data stays in EU)?**
  A: Region-pinned storage per tenant/user, routing by home region, no cross-border replication of regulated fields, tokenisation/pseudonymisation for global analytics, and audit evidence.
- **Q: Failover works in the diagram but fails in the drill. Typical reasons?**
  A: Hidden global dependencies (single-region auth, secrets, DNS), stale configs, insufficient capacity in the secondary (needs pre-provisioned headroom), replication lag larger than assumed, clients caching DNS, runbooks out of date, no tested restore.
- **Q: What is shuffle sharding?**
  A: Assign each customer a random small subset of nodes so a poison customer or failure affects only a few others sharing the same subset (blast radius shrinks combinatorially).

**Pitfalls:** claiming "active-active" without addressing write conflicts; ignoring the control-plane dependency; untested DR plans.

---

## 19. High-scale patterns: hot keys, fan-out, tail latency and overload

**Concepts**
- **Tail latency amplification:** fan-out calls make p99 dominate. Techniques: reduce fan-out, **hedged requests** (send a second request after the p95 delay, cancel the loser), **tied requests**, timeouts, selective replication, caching.
- **Overload control:** **admission control**, **load shedding** (drop low-priority work early, return 503/429 fast), **priority queues**, **adaptive concurrency limits**, **back-pressure**, **queue length limits** (long queues = latency without throughput), **graceful degradation** (serve cached/partial results).
- **Metastable failures:** retry storms or cache cold starts keep the system overloaded even after the trigger is gone; prevent with retry budgets, circuit breakers, warm caches, and load shedding.
- **Hot key / hot partition:** detect (heavy-hitter sketches), mitigate with local caches, key replication/salting, request coalescing, splitting hot ranges.
- **Fan-out strategies:** write-time (push) vs read-time (pull) vs hybrid; batching; limiting celebrity fan-out.
- **Counters at scale:** sharded counters, approximate counters (batch + flush), CRDT counters.
- **Thundering herd** on restart: staggered start, jittered schedules, warm-up.
- **Efficiency:** batching, compression, connection pooling and multiplexing, zero-copy I/O, async I/O, avoiding N+1, protocol choice (binary), data locality.
- **Capacity planning:** load tests, headroom (N+1/N+2), autoscaling limits and lead time, queueing theory basics (utilisation above ~70–80% sends latency up sharply: Little's law `L = λW`).
- **Cell-based architecture:** independent full-stack cells (capacity-limited) behind a thin router to cap blast radius.

**Question bank**
- **Q: Your p99 is 2 s but p50 is 80 ms. Where do you look?**
  A: Fan-out amplification, GC pauses, queueing at saturated resources, slow replicas/noisy neighbours, cold cache or cold start, retries, lock contention, large payloads. Use traces to find the slow span, compare percentiles per dependency, then apply hedging, timeouts, isolation or capacity.
- **Q: What is load shedding and how do you decide what to shed?**
  A: Rejecting excess work early to keep latency for the rest. Shed by priority (health checks, paying customers, writes over reads or the reverse depending on product), by cost, by age (drop requests whose client already timed out), and signal via 429/503 with Retry-After.
- **Q: Explain Little's Law and one practical use.**
  A: `L = λ × W` (average items in system = arrival rate × average time in system). If you serve 1,000 req/s with 200 ms latency, ~200 requests are in flight; size thread/connection pools and queues accordingly, and see that rising latency inflates concurrency, which can exhaust pools.
- **Q: A viral post causes one Redis shard to melt. What do you do right now and long term?**
  A: Immediately: local in-process cache for that key, request coalescing, shorter fan-out. Long term: replicate hot keys across nodes (key suffixing `key#0..n` with random reads), detect heavy hitters automatically, move to tiered caching/CDN for public content.
- **Q: Why is a long queue bad even when it prevents rejections?**
  A: Latency = queue wait + service time; a deep queue delays everything beyond client timeouts, wasting work on requests nobody is waiting for. Prefer bounded queues with early rejection and drop-oldest/LIFO policies under overload.
- **Q: How do hedged requests help and what is the risk?**
  A: Sending a duplicate to another replica after a short delay cuts tail latency caused by slow nodes (often reducing p99 substantially for ~5% extra load). Risk: amplifying load during overload; only for idempotent calls and cap hedging rate.
- **Q: How do you build a counter for likes on a viral post?**
  A: Shard the counter (N sub-counters in Redis, increment random shard, sum on read), buffer increments and flush in batches to the DB, accept eventual accuracy, and periodically reconcile from the source of truth.

**Pitfalls:** autoscaling as the only overload plan (too slow); unbounded queues; retrying on overload; designing for average load.

---

## 20. Multi-tenancy, security and compliance at scale

**Concepts**
- **Tenancy models:** silo (per-tenant stack/DB), pool (shared with `tenant_id`), bridge/hybrid. Choose by isolation needs, cost and tenant size distribution; tenant directory maps tenant → shard/region/tier.
- **Isolation layers:** data (row-level security, schema/DB per tenant, per-tenant encryption keys), compute (quotas, cgroups, dedicated pools), network, and **fairness** (rate limits, weighted queues, per-tenant concurrency caps) against noisy neighbours.
- **Identity at scale:** SSO (SAML/OIDC), SCIM provisioning, tenant-scoped RBAC/ABAC, service identities, short-lived credentials, workload identity; **zero trust** (authenticate and authorise every hop).
- **Encryption & key management:** envelope encryption, KMS/HSM, per-tenant keys (BYOK/HYOK), rotation, secrets management; field-level encryption and tokenisation for sensitive data.
- **Compliance:** GDPR/CCPA (consent, export, erasure/"right to be forgotten", residency), SOC 2, ISO 27001, PCI-DSS (reduce scope via tokenisation), HIPAA. Design implications: data inventory, retention, deletion pipelines that reach backups/caches/search/analytics, audit logs (immutable, tamper-evident).
- **Supply chain & platform security:** dependency scanning, SBOMs, signed artifacts, least-privilege CI, secret scanning, hardened images, network policies, WAF/DDoS protection, bot management.
- **Threat modelling:** STRIDE; assets, trust boundaries, abuse cases; defence in depth; secure defaults.
- **Abuse & fraud controls:** rate limiting per identity/IP/device, anomaly detection, step-up auth, CAPTCHA/attestation.
- **Auditability:** who did what, when, from where; separation of duties; break-glass access with approval and logging.

**Question bank**
- **Q: How do you guarantee one tenant can't read another's data in a pooled database?**
  A: Defence in depth: tenant ID derived from the verified credential (never the request body), mandatory tenant filter in a data-access layer, **row-level security** enforced by the database, tests that attempt cross-tenant access (including mutation tests that remove the filter), per-tenant encryption keys for sensitive data, and audit logging.
- **Q: How do you prevent noisy neighbours?**
  A: Per-tenant rate limits and quotas, concurrency caps, weighted fair queues for background jobs, resource pools by tier, per-tenant DB connection limits, and routing heavy tenants to dedicated infrastructure.
- **Q: Implement "delete my account" (GDPR erasure) across a distributed system.**
  A: Maintain a data map; issue an idempotent deletion event consumed by each service (DB rows, object storage, search indexes, caches, analytics, ML features); handle backups via retention expiry or crypto-shredding (delete the tenant/user key); track completion and produce an audit record; define legal-hold exceptions.
- **Q: What is crypto-shredding?**
  A: Encrypt each tenant's/user's data with its own key; deleting the key renders all copies (including backups) unreadable. Efficient erasure where deleting from immutable backups is impractical.
- **Q: How do you reduce PCI scope?**
  A: Never touch raw card data: use the processor's hosted fields/tokenisation, store only tokens and last four digits, segment networks so the cardholder data environment is minimal.
- **Q: How do you design admin/support access safely?**
  A: Least privilege, just-in-time elevation with approval and expiry, session recording/audit, customer-visible access logs, no standing production credentials, and masked data by default.
- **Q: Zero trust in one sentence, and one concrete implementation?**
  A: Never trust network location; authenticate and authorise every request. Implementation: mTLS between services with workload identity and policy enforcement per call (service mesh/IAM), plus short-lived tokens carrying user context.

**Pitfalls:** tenant ID passed from the client; deleting from the primary but forgetting search/cache/backups; compliance as a document instead of automated controls.

---

## 21. ML and LLM systems at scale

**Concepts**
- **ML system lifecycle:** data collection → feature engineering (**feature store**: online/offline parity) → training pipelines (reproducible, versioned data/code/model) → evaluation → registry → deployment → monitoring (data drift, concept drift, performance) → retraining.
- **Serving:** online vs batch inference; model servers (Triton, TorchServe, TF Serving, vLLM); **dynamic batching** (latency vs GPU utilisation), quantisation (INT8/FP8), compilation (TensorRT/ONNX), autoscaling on queue/latency, canary/shadow/A-B rollouts, caching of deterministic predictions.
- **Recommendation/search funnels:** candidate generation (ANN/embeddings) → ranking → re-ranking/business rules; two-tower models; cold-start strategies; exploration (bandits).
- **LLM application architecture:** gateway (auth, rate/spend limits, routing, fallback, caching, logging), **RAG** (chunk → embed → hybrid retrieve → rerank → generate with citations), **agents** (tool calling with allow-lists, bounded loops, budgets, human approval for risky actions), **guardrails** (input/output filters, prompt-injection defences, PII handling), **evals** (golden sets, judge calibration, regression gates, online sampling), **observability** (traces with tokens, cost, latency).
- **LLM serving internals:** KV cache, continuous batching, paged attention, speculative decoding, prefill vs decode phases, tensor/pipeline parallelism; token-based rate limits; streaming responses.
- **Cost levers:** model tiering/routing, prompt trimming, prompt caching, semantic/response caching, batching, output caps, smaller fine-tuned models for narrow tasks, distillation.
- **Vector search at scale:** HNSW vs IVF-PQ, filtered search, sharding by tenant, index rebuild/versioning, recall–latency–memory trade-offs.
- **Data & privacy:** PII redaction, tenant isolation of indexes, retention, model-provider data policies, regional routing.
- **Failure modes unique to ML:** silent quality decay, training/serving skew, feedback loops, non-determinism, prompt/model version drift.

**Question bank**
- **Q: How do you prevent training–serving skew?**
  A: A single feature definition used for both offline training and online serving (feature store), point-in-time-correct training sets, logging served features for later training, and monitoring feature distributions in production against training.
- **Q: How would you detect model degradation in production?**
  A: Monitor input drift (PSI/KS tests), prediction distribution, and, when labels arrive, actual quality metrics; use proxy metrics when labels lag; alert on thresholds; shadow-evaluate challenger models; automatic or manual retraining triggers.
- **Q: Dynamic batching: what's the trade-off?**
  A: Waiting a few milliseconds to batch requests raises GPU throughput and lowers cost per request, at the price of added latency; tune max batch size and max wait to the latency SLO.
- **Q: Design the serving path for an LLM feature that must stay under budget.**
  A: Gateway enforcing per-tenant token budgets; route simple tasks to a small model and escalate when needed; cache by exact and semantic match; trim and compress context via retrieval instead of stuffing; stream tokens; cap output length; fall back to another provider on errors; track cost per task. Evaluate each cost lever against the golden set before shipping.
- **Q: How do you make an LLM agent safe to run in production?**
  A: Read-only tools first, allow-listed tools with strict schemas and server-side authorisation, budgets for steps/tokens/dollars, sandboxed code execution, human approval for irreversible actions, injection defences that assume the model may comply, complete audit traces, and kill switches.
- **Q: How do you evaluate a RAG system continuously?**
  A: Offline golden set with retrieval metrics (recall@k, MRR) and generation metrics (faithfulness, citation correctness); judge calibrated on human labels; CI regression gate; online sampled scoring, user feedback, drift monitors; production failures feed back into the golden set.
- **Q: How would you scale vector search to a billion vectors?**
  A: Compress with product quantisation (IVF-PQ) or use disk-based ANN, shard by tenant or hash with scatter-gather, replicate for QPS, use filtered search and a reranker to recover precision, and keep an offline process for index rebuilds with versioned aliases.
- **Q: Fine-tune, RAG or prompt engineering?**
  A: Start with prompting (cheapest to iterate), add RAG for knowledge that is large, private or changing, fine-tune for style, format, latency or cost on a narrow stable task. Decide using evals; they are not mutually exclusive.

**Pitfalls:** shipping without evals; ignoring cost per task; trusting retrieved text as instructions; treating the model as deterministic.

---

# Practice system

## Level-up checklist (tick before moving on)

**Basics: can you, unaided, …**
- [ ] estimate QPS/storage/bandwidth for a new product in 3 minutes and state assumptions
- [ ] explain the request path from DNS to database and where caching sits
- [ ] choose SQL vs NoSQL from access patterns and explain indexes, isolation levels and write skew
- [ ] describe cache-aside, the stampede problem and its fixes
- [ ] explain JWT vs sessions, OAuth code + PKCE, and prevent IDOR

**Intermediate: can you …**
- [ ] explain replication lag anomalies and fixes, quorums (R+W>N), failover and fencing
- [ ] pick a shard key and justify it; explain consistent hashing and resharding
- [ ] explain queue vs log, at-least-once + idempotency, outbox and DLQ handling
- [ ] design timeouts/retries/circuit breakers and a saga for a multi-service workflow
- [ ] explain CAP, PACELC, linearizability vs serializability with examples
- [ ] choose search/approximate data structures (inverted index, Bloom, HLL, Count-Min, geohash)
- [ ] define SLOs, canary rollout, expand/contract migrations, RPO/RTO

**Advanced: can you …**
- [ ] explain Raft and fencing tokens and say why a Redis lock is not a correctness lock
- [ ] compare B-tree and LSM, WAL durability, Dynamo vs Spanner transaction models
- [ ] design an exactly-once-effect streaming pipeline with event-time windows and CDC
- [ ] design multi-region active-active with conflict resolution and a tested DR plan
- [ ] diagnose tail latency, add load shedding, hedging, and handle hot keys
- [ ] design tenant isolation, erasure (crypto-shredding), and least-privilege admin access
- [ ] design an LLM/ML serving and evaluation loop with cost, safety and drift controls

## 9-week plan (≈ 6–8 h/week)

| Week | Focus | Output |
|---|---|---|
| 1 | Topics 1–3 | Do 5 estimation drills; draw the DNS→DB path from memory |
| 2 | Topics 4–7 | Write one schema + index plan; implement a rate limiter and cache-aside with stampede protection |
| 3 | Topics 8–9 | Whiteboard failover + quorum scenarios; implement the consistent-hash ring |
| 4 | Topics 10–11 | Build outbox + idempotent consumer; design a saga on paper |
| 5 | Topics 12–14 | Answer 10 CAP/consistency questions aloud; define SLOs for one service |
| 6 | Topics 15–16 | Re-derive Raft from memory; compare B-tree and LSM on a workload table |
| 7 | Topics 17–18 | Design a CDC pipeline; run a paper DR drill with RPO/RTO |
| 8 | Topics 19–20 | Overload and hot-key post-mortems; tenant-isolation threat model |
| 9 | Topic 21 + mocks | Two full 45-minute mock designs per week, recorded; review against the companion problems guide |

**Spaced repetition:** re-answer the question banks at 3, 10 and 30 days; any answer you can't give in 60 seconds goes back on the list.

## Recommended sources
*Designing Data-Intensive Applications* (Kleppmann); *System Design Interview* vols 1–2 (Xu); Google SRE Book and Workbook; AWS Builders' Library (timeouts/retries/backoff, shuffle sharding, static stability); the Raft paper and visualisation (raft.github.io); Dynamo, Bigtable, Spanner, Kafka papers; Martin Kleppmann's blog on distributed locking and fencing.
