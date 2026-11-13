# System Design Answer Guide

Companion to a separate interview-prep topic list. Topic numbers match that list (#1–#37).

**Each topic has four parts:**
1. **Clarify first:** questions to ask the interviewer before drawing anything.
2. **Approach to settle before you answer:** the decisions that shape the whole design.
3. **Final answer:** requirements, estimates, API, data model, architecture, deep dive.
4. **Considerations / trade-offs:** what to say when probed, plus code where code helps.

---

## How to run every answer (45 minutes)

| Min | Step | What to say/do |
|---|---|---|
| 0–5 | Requirements | Functional (top 3–5 features), non-functional (scale, latency, availability vs consistency), explicit out-of-scope |
| 5–8 | Estimates | DAU → QPS (÷ 86,400, peak ≈ 2–3×), storage/day × retention, read:write ratio |
| 8–15 | API + data model | 3–6 endpoints; main entities, keys, indexes; pick the datastore and justify it |
| 15–25 | High-level diagram | Client → CDN/LB → stateless services → cache → DB/queue/blob; draw the happy path |
| 25–40 | Deep dive | The 1–2 hardest problems (hot keys, fan-out, consistency, ordering, scaling the DB) |
| 40–45 | Wrap-up | Failure modes, monitoring, bottlenecks, what you'd do with more time |

**Numbers to keep in your head:** 1 day ≈ 10⁵ s (86,400); 1M req/day ≈ 12 QPS; 100M/day ≈ 1,200 QPS; one Postgres node ≈ 5–10k simple QPS; Redis ≈ 100k+ ops/s per node; one Kafka broker ≈ hundreds of MB/s; SSD read ≈ 100 µs, network round trip in a DC ≈ 0.5 ms, cross-continent ≈ 150 ms; 1 char = 1 byte, a tweet-sized record ≈ 300 B, a photo ≈ 2 MB, a video minute ≈ 10–50 MB.

**Universal talking points (use them whenever relevant):** stateless services behind a load balancer; cache-aside with TTL and invalidation; read replicas for read-heavy, sharding for write-heavy; idempotency keys on every retried write; queues to absorb spikes and decouple; rate limiting and back-pressure; timeouts + retries with jitter + circuit breakers; metrics, logs, traces, alerts; consistency choice stated explicitly (strong vs eventual) per data type.

---

# EASY

## 1. URL Shortener (TinyURL) ★

**Clarify first**
- Custom aliases? Expiry? Analytics (click counts)? Edit/delete links?
- Scale: new URLs/day, read:write ratio (assume 100:1)? Latency target for redirect?
- Is a shorter link guaranteed unique per long URL, or may duplicates exist?

**Approach before answering**
- The key decision is **how to generate the short code**: hash + truncate (collisions), counter + base62 (needs a coordinated counter), or pre-generated key service (a KGS). Pick counter/KGS for guaranteed uniqueness.
- Reads dominate, so lean on **cache + CDN**; use 301 (cacheable, less load) or 302 (lets you count every click). Say which and why.

**Final answer**
- **Estimates:** 100M new URLs/month ≈ 40 writes/s; 100:1 reads ≈ 4,000 reads/s. 5 years × 1.2B URLs × ~500 B ≈ 600 GB, which is small.
- **API:** `POST /urls {longUrl, alias?, ttl?}` → `{shortUrl}`; `GET /{code}` → `302 Location: longUrl`.
- **Data model:** `urls(code PK, long_url, user_id, created_at, expires_at)`. Key-value access pattern → DynamoDB/Cassandra, or sharded Postgres by `code`.
- **Code generation:** 7 base62 chars = 62⁷ ≈ 3.5 trillion codes. Each app server leases a **range of IDs** (e.g. 1M at a time) from a coordinator (ZooKeeper/etcd or a DB sequence) and base62-encodes a local counter; no per-request coordination. To stop sequential guessing, run the ID through a bijective scramble (e.g. XOR/multiply mod 62⁷).
- **Read path:** CDN/edge → app → Redis (cache-aside, LRU, TTL) → DB. Hot links stay in cache; 20% of codes serve ~80% of traffic.
- **Analytics:** emit click events to Kafka asynchronously; never block the redirect.

**Considerations / trade-offs**
- Hash-based (MD5 → first 7 chars) is stateless but collides; handle with retry/append salt.
- 301 reduces load but hides clicks from you; 302 costs more but gives analytics.
- Abuse: rate limit creation, malware/phishing URL scanning, block redirect loops.
- Expiry: lazy delete on read + background sweeper; recycle codes only after a long cool-down.

```ts
const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
function toBase62(n: bigint): string {
  if (n === 0n) return "0";
  let s = "";
  while (n > 0n) { s = ALPHABET[Number(n % 62n)] + s; n /= 62n; }
  return s;
}
// each app server leases [start, start+1_000_000) from the coordinator, then:
let next = 0n; // set from the leased range
const newCode = () => toBase62(next++).padStart(7, "0");
```

---

## 2. Rate Limiter ★

**Clarify first**
- Client-side, server-side, or an API-gateway component? Limit by user, IP, API key, or endpoint?
- Hard limit or soft (allow bursts)? Single region or distributed across many gateway nodes?
- What happens when limited: reject with 429, queue, or degrade? What if the limiter itself is down (fail open or closed)?

**Approach before answering**
- Choose the algorithm: **token bucket** (allows bursts, most common), leaky bucket (smooth output), fixed window (cheap, boundary spikes), sliding window log (exact, memory heavy), sliding window counter (good approximation). Default answer: token bucket.
- Distributed correctness: the counter must live in a shared store (Redis) updated **atomically** (Lua script), or you accept approximate local limits.

**Final answer**
- **Placement:** middleware at the API gateway (before business logic), keyed by `{tenant/user/apiKey}:{route}`.
- **Rules:** stored in a config service, cached locally (e.g. `free: 60/min`, `pro: 600/min`, `POST /payments: 10/min`).
- **State:** Redis hash per key: `tokens`, `lastRefill`. A single Lua script reads, refills (`tokens = min(cap, tokens + elapsed*rate)`), decrements, and returns allow/deny. The script is atomic so there are no races across gateways.
- **Response:** `429 Too Many Requests` with `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.
- **Scale:** shard Redis by key hash (consistent hashing); one Redis node handles 100k+ ops/s. Multi-region: per-region limits with periodic sync, or a global limit using a regional budget split.
- **Failure mode:** fail **open** for general APIs (availability), fail **closed** for expensive/abuse-prone endpoints.

**Considerations / trade-offs**
- Fixed window lets 2× the limit through at a boundary; sliding window counter fixes this at the cost of a little memory.
- Local in-memory limiter + periodic sync = lower latency but slightly loose limits.
- Fairness: per-tenant limits prevent one noisy neighbour.
- Distinguish rate limiting (requests/time) from concurrency limiting (in-flight requests) and from quotas (monthly spend).

```lua
-- KEYS[1]=bucket key; ARGV: capacity, refill_per_sec, now_ms
local b = redis.call("HMGET", KEYS[1], "t", "ts")
local cap, rate, now = tonumber(ARGV[1]), tonumber(ARGV[2]), tonumber(ARGV[3])
local tokens = tonumber(b[1]) or cap
local ts = tonumber(b[2]) or now
tokens = math.min(cap, tokens + (now - ts) / 1000 * rate)
local allowed = 0
if tokens >= 1 then tokens = tokens - 1; allowed = 1 end
redis.call("HSET", KEYS[1], "t", tokens, "ts", now)
redis.call("PEXPIRE", KEYS[1], math.ceil(cap / rate * 1000) * 2)
return allowed
```

---

## 3. Pastebin

**Clarify first**
- Max paste size? Expiry options? Private/unlisted/public? Syntax highlighting? Accounts needed?
- Scale (pastes/day) and read:write ratio? Is edit supported or are pastes immutable?

**Approach before answering**
- Same shape as a URL shortener, but the payload is **large** → keep **metadata in a DB and content in object storage (S3)**. Immutability makes caching and CDN trivial.

**Final answer**
- **Estimates:** 1M pastes/day ≈ 12 writes/s; 5:1 reads → 60 reads/s; avg 10 KB → 10 GB/day, ~3.6 TB/year (S3 is cheap, DB would not be).
- **API:** `POST /pastes {content, expiry, visibility}` → `{id}`; `GET /pastes/{id}`; `DELETE /pastes/{id}`.
- **Data model:** `pastes(id PK, owner_id, s3_key, size, created_at, expires_at, visibility)`; content at `s3://bucket/{id}`.
- **ID generation:** same KGS/range-lease approach as TinyURL (random, unguessable IDs for unlisted pastes).
- **Write path:** app → validate size/rate limit → write blob to S3 → insert metadata → return ID.
- **Read path:** CDN (immutable → long TTL) → app → Redis metadata cache → S3.
- **Expiry:** TTL index/lifecycle rule plus a background sweeper; S3 lifecycle rules for blobs.

**Considerations / trade-offs**
- Inline small pastes (<4 KB) in the DB to save a round trip; large ones to S3.
- Abuse: size caps, rate limits, malware scanning, takedown flow.
- Private pastes: signed URLs with short expiry for S3 access.

---

## 4. Key-Value Store

**Clarify first**
- Single node or distributed? Size of keys/values? Read/write ratio? Strong or eventual consistency?
- Durability required (survive restarts)? Need TTLs, range scans, transactions?

**Approach before answering**
- Start with the **single-node engine** (memtable + WAL + SSTables = LSM tree, or B-tree), then scale out: **partitioning (consistent hashing), replication, and a consistency model** (Dynamo-style quorum is the classic answer).

**Final answer**
- **API:** `put(key, value)`, `get(key)`, `delete(key)` (optionally `ttl`).
- **Single node (LSM):** write → append to **WAL** (durability) → insert into in-memory **memtable** (sorted) → flush as immutable **SSTable** → background **compaction**. Reads check memtable → **Bloom filters** → SSTables (newest first).
- **Partitioning:** consistent hashing ring with virtual nodes; each key lives on N successive nodes.
- **Replication:** N=3, write quorum W=2, read quorum R=2 (R+W>N gives strong-ish reads); tune for availability (W=1) or consistency.
- **Conflicts:** vector clocks or last-write-wins timestamps; **read repair** and **anti-entropy (Merkle trees)** converge replicas.
- **Failures:** gossip protocol for membership/failure detection; **hinted handoff** and sloppy quorum keep writes available when a replica is down.
- **Coordinator:** any node can coordinate a request; clients/proxies route using the ring.

**Considerations / trade-offs**
- CAP: Dynamo-style = AP with tunable consistency; Raft/Paxos-backed (etcd, Spanner) = CP.
- LSM = fast writes, slower reads (compaction, Bloom filters help); B-tree = faster reads, write amplification.
- Hot keys: replicate or cache hot partitions; rebalance by moving virtual nodes.

---

## 5. Unique ID Generator (Snowflake) ★

**Clarify first**
- Must IDs be sortable by time? Numeric 64-bit? Peak IDs/second? Strict ordering across machines or just roughly sorted?
- How many datacentres/machines? Tolerance for clock skew?

**Approach before answering**
- Compare: **DB auto-increment** (single point of failure, hard to scale), **UUIDv4** (128-bit, random, bad for index locality), **ticket server** (central bottleneck), and **Snowflake** (64-bit, time-sortable, no coordination). Recommend Snowflake (or UUIDv7 if 128-bit is fine).

**Final answer**
- **Layout (64 bits):** 1 sign bit | 41 bits timestamp (ms since custom epoch, ≈69 years) | 10 bits machine ID (5 DC + 5 worker) | 12 bits sequence (4096 IDs/ms/machine). Capacity ≈ 4M IDs/s per machine.
- **Machine IDs:** assigned at startup via ZooKeeper/etcd lease or config; never reused concurrently.
- **Generation:** if same ms as last ID → `sequence++` (if it overflows, spin until next ms); else sequence = 0.
- **Clock going backwards (NTP):** refuse to issue IDs until the clock catches up (or throw/alert); keep `lastTimestamp` persisted/in memory.
- **Properties:** roughly time-ordered, unique without coordination, fits a `BIGINT`, B-tree friendly inserts.

**Considerations / trade-offs**
- Ordering is only guaranteed per machine; across machines it is "k-sorted" within clock skew.
- Embedding time leaks creation timestamps; fine for most systems, not for secrets.
- Sharding DBs by ID: the timestamp prefix can create a hot shard (all new writes), so hash the ID for shard choice.

```ts
class Snowflake {
  private readonly EPOCH = 1700000000000n;
  private last = -1n;
  private seq = 0n;
  constructor(private machineId: bigint /* 0..1023 */) {}
  next(): bigint {
    let now = BigInt(Date.now());
    if (now < this.last) throw new Error("clock moved backwards");
    if (now === this.last) {
      this.seq = (this.seq + 1n) & 4095n;
      if (this.seq === 0n) while (now <= this.last) now = BigInt(Date.now());
    } else this.seq = 0n;
    this.last = now;
    return ((now - this.EPOCH) << 22n) | (this.machineId << 12n) | this.seq;
  }
}
```

---

## 6. Web Crawler

**Clarify first**
- Purpose: search indexing, data mining, archiving? Scale (pages/month)? HTML only or also images/PDF?
- Freshness requirement (recrawl frequency)? Respect robots.txt? JS-rendered pages?

**Approach before answering**
- It is a **distributed BFS** with three hard problems: **politeness** (don't hammer a host), **dedupe** (URLs and content), and **scale/fault tolerance** (billions of URLs). Organise the design around those.

**Final answer**
- **Estimates:** 1B pages/month ≈ 400 pages/s; 100 KB avg → 100 TB/month raw.
- **Pipeline:** Seed URLs → **URL Frontier** → **Fetchers** (DNS resolve, download) → **Parser** (extract text/links) → **Content dedupe** (hash/simhash) → **Storage** (blob store + index) → **URL filter/dedupe** (Bloom filter + DB) → back into the frontier.
- **URL frontier:** two layers: *priority queues* (PageRank/freshness/importance) feeding *per-host back queues*; one worker owns one host's queue at a time, enforcing a delay between requests (politeness; honour `robots.txt` and `Crawl-delay`).
- **Dedupe:** URL normalisation (lowercase host, strip fragments, sort params) + Bloom filter for "seen"; content-level via checksum/SimHash to catch mirrors.
- **DNS:** local cache (DNS is a major bottleneck).
- **Fault tolerance:** frontier persisted (Kafka/DB), fetchers stateless; retry with backoff; crawl-state checkpoints.
- **Traps:** max depth, max URLs per domain, detect calendar/infinite-URL patterns.
- **Freshness:** recrawl intervals adapt to observed change rate (news hourly, static pages monthly).

**Considerations / trade-offs**
- BFS vs priority-driven crawl: BFS is simple, priority crawl finds important pages first.
- Headless rendering is 10–100× more expensive; use it only for JS-heavy domains.
- Legal/ethical: robots.txt, rate limits, identify your user agent.

---

## 7. Notification System

**Clarify first**
- Channels: push, SMS, email, in-app? Transactional vs marketing? Scale (notifications/day) and peak bursts?
- Delivery guarantee (at-least-once is typical)? User preferences / quiet hours / unsubscribe? Scheduling? Templates and localisation?

**Approach before answering**
- **Decouple** producers from delivery with a queue, and use **one queue + worker pool per channel** so a slow SMS vendor cannot block push. Idempotency and retry/DLQ are the correctness story.

**Final answer**
- **Flow:** Producer services → `POST /notify {userId, type, payload, idempotencyKey}` → **Notification service** (validate, check preferences, rate limit, render template) → **channel queues** (Kafka/SQS: push, SMS, email) → **channel workers** → providers (APNs/FCM, Twilio, SES) → **status/webhook callbacks** → delivery log.
- **Data:** `user_prefs(user_id, channel, enabled, quiet_hours)`, `device_tokens(user_id, token, platform)`, `templates`, `notification_log(id, user, channel, status, attempts, ts)`.
- **Reliability:** at-least-once with **idempotency keys** (dedupe in Redis) so retries do not double-send; exponential backoff; **dead-letter queue** after N failures; fall back to another channel for critical messages.
- **Priority:** separate high-priority queue (OTPs, security alerts) from bulk (marketing) so campaigns never delay OTPs.
- **Scale:** workers autoscale on queue depth; provider rate limits respected per vendor; batching for email.
- **Scheduling:** delayed queue / scheduler service (timing wheel or DB poll) for future sends.

**Considerations / trade-offs**
- Exactly-once is not achievable end-to-end across third-party providers; design for at-least-once + dedupe.
- Compliance: unsubscribe, consent, regional quiet hours (CAN-SPAM, GDPR/CASL for you in Canada).
- Metrics: delivered, opened, bounced, latency per channel; alert on provider error rates.

---

## 8. Parking Lot / Library System (OOD-style)

**Clarify first**
- Parking lot: vehicle types, multiple floors/entrances, pricing model (hourly/flat), payment methods, reservations?
- Library: members, book copies vs titles, borrowing limits, due dates/fines, reservations/holds, search?

**Approach before answering**
- OOD rounds grade **entities, relationships, responsibilities and extensibility**, not scale. List nouns → classes, verbs → methods, then identify where **strategy/factory/observer** patterns remove `if/else` chains. Keep SOLID in view; state concurrency concerns (two cars, one spot) at the end.

**Final answer (Parking lot)**
- **Entities:** `ParkingLot` → `Floor` → `Spot` (subtypes by size: Compact/Large/Motorbike/EV); `Vehicle` (Car, Truck, Motorbike); `Ticket` (id, vehicle, spot, entryTime); `EntryGate`/`ExitGate`; `Payment`; `PricingStrategy`.
- **Flows:** *Entry* → find nearest free spot compatible with vehicle → mark occupied → issue ticket. *Exit* → compute fee via `PricingStrategy` → process payment → free spot.
- **Patterns:** **Strategy** for pricing (hourly, flat, peak) and spot-assignment (nearest, lowest floor); **Factory** for vehicles/spots; **Observer** for "lot full" signs.
- **Concurrency:** spot allocation must be atomic (lock per spot or DB row lock/`UPDATE ... WHERE free`).
- **Library:** `Book` (title) vs `BookItem` (physical copy), `Member`, `Loan`, `Reservation`, `Fine`; `LibraryService.checkout()` enforces limits; observer sends due-date reminders.

**Considerations / trade-offs**
- Keep the spot-finding data structure efficient (min-heap/free list per spot type) instead of scanning all spots.
- Extensibility: adding a new vehicle type should touch one place.

```ts
type SpotSize = "MOTO" | "COMPACT" | "LARGE";
interface PricingStrategy { fee(entry: Date, exit: Date): number; }
class HourlyPricing implements PricingStrategy {
  constructor(private ratePerHour: number) {}
  fee(entry: Date, exit: Date) {
    const hours = Math.ceil((exit.getTime() - entry.getTime()) / 3_600_000);
    return Math.max(1, hours) * this.ratePerHour;
  }
}
class Spot {
  vehicleId: string | null = null;
  constructor(readonly id: string, readonly size: SpotSize, readonly floor: number) {}
  get free() { return this.vehicleId === null; }
}
class ParkingLot {
  private freeSpots = new Map<SpotSize, Spot[]>();
  private tickets = new Map<string, { spot: Spot; entry: Date }>();
  constructor(spots: Spot[], private pricing: PricingStrategy) {
    for (const s of spots) (this.freeSpots.get(s.size) ?? this.freeSpots.set(s.size, []).get(s.size)!).push(s);
  }
  enter(vehicleId: string, need: SpotSize): string | null {
    const spot = this.freeSpots.get(need)?.pop();
    if (!spot) return null;
    spot.vehicleId = vehicleId;
    const ticket = crypto.randomUUID();
    this.tickets.set(ticket, { spot, entry: new Date() });
    return ticket;
  }
  exit(ticket: string): number {
    const t = this.tickets.get(ticket)!;
    this.tickets.delete(ticket);
    t.spot.vehicleId = null;
    this.freeSpots.get(t.spot.size)!.push(t.spot);
    return this.pricing.fee(t.entry, new Date());
  }
}
```

---

# MEDIUM

## 9. News Feed / Twitter Timeline ★

**Clarify first**
- Followers per user (celebrity accounts)? Feed ranked or reverse-chronological? Media in posts? Real-time or near-real-time?
- Scale: DAU, posts/day, average follows? Read:write ratio (very read-heavy)?

**Approach before answering**
- The central decision is **fan-out-on-write (push)** vs **fan-out-on-read (pull)**. Push = fast reads, expensive writes for celebrities. Pull = cheap writes, slow reads. Answer: **hybrid**; push for normal users, pull for celebrities merged at read time.

**Final answer**
- **Estimates:** 300M DAU, each reads feed 10×/day ≈ 35k reads/s; 100M posts/day ≈ 1.2k writes/s. Feed reads are ~30× writes.
- **API:** `POST /posts`; `GET /feed?cursor=` (cursor pagination, never offset); `POST /follow/{userId}`.
- **Data:** `posts(post_id, author_id, text, media_url, ts)` (sharded by author or post_id); `follows(follower_id, followee_id)` (graph store or sharded table); `feed:{userId}` = Redis sorted set of `(post_id, ts)` capped to ~800 entries.
- **Write path:** post saved → published to Kafka → **fan-out workers** read the author's follower list, push `post_id` into each follower's feed cache (skip inactive users).
- **Read path:** fetch `post_id`s from feed cache → merge with recent posts from followed celebrities (pull) → hydrate post/user objects from cache (`MGET`) → rank → return.
- **Media:** uploaded to object storage, served by CDN.
- **Ranking:** start chronological; later add an ML ranker (recency, affinity, engagement) as a separate service on the candidate set.

**Considerations / trade-offs**
- Celebrity threshold (e.g. >100k followers) switches the strategy; avoids 50M writes per post.
- Cache memory cost: store only IDs in feeds, hydrate separately.
- Consistency: eventual is fine; a post may appear seconds late; ensure users always see their own post immediately (read-your-writes via local insert).
- Deleted/blocked content: filter at hydration time.

---

## 10. Chat System (WhatsApp / Slack) ★

**Clarify first**
- 1:1 only or group chat (max size)? Online presence, read receipts, typing indicators? Media? Message history retention? End-to-end encryption? Multi-device?
- Scale: DAU, messages/day? Delivery guarantee (no lost, ordered messages)?

**Approach before answering**
- Transport: **WebSocket** persistent connections (HTTP long-polling as fallback). Key problems: **routing a message to the right connection server**, **ordering/idempotency**, **offline delivery**, **group fan-out**.

**Final answer**
- **Estimates:** 500M DAU × 40 msgs = 20B msgs/day ≈ 230k msgs/s; 100 B/msg → ~2 TB/day text.
- **Architecture:** Clients ⇄ **Gateway/Chat servers** (stateful WebSocket, ~100k connections each) ⇄ **Session registry** (Redis: `userId → serverId`) ⇄ **Message service** → **Message store**; **Push service** (APNs/FCM) for offline users; **Presence service** (heartbeats with TTL).
- **Send flow (1:1):** A sends → chat server assigns message ID (per-conversation monotonic sequence) → persists to store → looks up B's server in the registry → forwards over B's socket → B acks → status updates (sent/delivered/read). If B offline → store in inbox + push notification; B syncs on reconnect via `GET /sync?since=seq`.
- **Groups:** one message written once, fan-out to each member's connection/inbox. Small groups: push; very large channels: pull by sequence.
- **Storage:** write-heavy, time-ordered → **Cassandra/HBase/DynamoDB**, partition key `conversation_id`, clustering by `message_seq`. Metadata/users in a relational DB.
- **Ordering:** sequence number per conversation (single writer per conversation shard, or Snowflake IDs); client dedupes by message ID (at-least-once + idempotency).
- **Presence:** heartbeat every ~5 s; "online" = heartbeat within TTL; fan-out presence changes only to friends who are currently online/viewing.

**Considerations / trade-offs**
- Connection servers are stateful → graceful draining, consistent hashing or registry for routing, reconnect storms (jittered backoff).
- E2E encryption (Signal protocol): server stores ciphertext only; limits server-side search and complicates multi-device.
- Message search = separate index (Elasticsearch) fed asynchronously.

---

## 11. Video Streaming (YouTube / Netflix) ★

**Clarify first**
- Upload by anyone (YouTube) or curated catalogue (Netflix)? Live streaming? Max video size/length? Devices and regions? Recommendations in scope? DRM?
- Scale: DAU, hours watched/day, uploads/day?

**Approach before answering**
- Two separate pipelines: **upload/transcode (write path)** and **playback delivery (read path)**. Delivery is the cost driver → **CDN + adaptive bitrate streaming** is the heart of the answer.

**Final answer**
- **Upload path:** client uploads in chunks (resumable, pre-signed URL) to **object storage** → event → **transcoding pipeline** (DAG of workers: split into segments → encode to multiple resolutions/codecs (240p–4K; H.264/VP9/AV1) → generate thumbnails → package into **HLS/DASH** manifests + segments) → store encoded segments → update metadata → mark "ready".
- **Metadata DB:** `videos(id, owner, title, status, manifest_url)`, sharded SQL/NoSQL + search index; counters (views/likes) batched via Kafka to avoid hot rows.
- **Playback:** player requests manifest → picks bitrate based on bandwidth (**adaptive bitrate**) → fetches 2–10 s segments from the nearest **CDN edge**; cache miss → regional cache → origin storage.
- **CDN strategy:** push popular titles to edge ahead of time (Netflix Open Connect appliances in ISPs); pull-through caching for the long tail.
- **Estimates:** 1B hours/day at ~3 Mbps ≈ ~1.3 PB/hour egress, why CDN is mandatory (and why cost dominates).
- **Recommendations/search:** separate services; out of the main playback path.

**Considerations / trade-offs**
- Storage multiplies (each video stored in many renditions); cold content moved to cheaper tiers.
- Transcoding is CPU/GPU heavy → queue + autoscaled spot instances; parallelise per segment.
- Live: ingest via RTMP/WebRTC → low-latency HLS; segments of 1–2 s; no pre-warming possible.
- Resume/continue-watching = small per-user key-value store.

---

## 12. File Storage and Sync (Dropbox / Google Drive) ★

**Clarify first**
- File size limits? Sharing and permissions? Version history? Offline editing and conflict handling? Platforms (desktop/mobile/web)? Scale of users and storage?

**Approach before answering**
- Split files into **chunks (e.g. 4 MB)** with content hashes: enables **delta sync (upload only changed chunks), dedupe, resumable uploads, and parallel transfer**. Separate **metadata** (small, relational) from **blocks** (large, object storage).

**Final answer**
- **Client:** watches the folder, chunks files, computes SHA-256 per chunk, compresses/encrypts, uploads only chunks the server lacks.
- **Services:** **Block service** (chunk upload/download → S3, content-addressed by hash, ref-counted for dedupe), **Metadata service** (file tree, versions, chunk lists, permissions; sharded SQL), **Notification/sync service** (long-poll/WebSocket telling other devices "namespace changed, cursor = N").
- **Upload flow:** client sends file manifest (chunk hashes) → server replies with missing chunks → client uploads those → commits new file version (atomic metadata transaction) → change event published → other devices pull the delta since their cursor.
- **Data model:** `files(file_id, ns_id, path, version, chunk_list[], size, mtime)`, `chunks(hash, s3_key, refcount)`, `sharing(file_id, principal, role)`.
- **Conflicts:** last-writer wins is unsafe; create a **"conflicted copy"** file with both versions preserved (Dropbox approach).
- **Scale:** metadata DB sharded by `namespace_id`; blocks effectively unlimited in S3; hot/cold storage tiering.

**Considerations / trade-offs**
- Chunk size: small = better dedupe/delta, more metadata; large = fewer requests.
- Client-side vs server-side encryption (zero-knowledge vs searchable/dedupe across users).
- Dedupe across users leaks existence of files (side channel); many systems dedupe only per account.

---

## 13. Ride Sharing (Uber) ★

**Clarify first**
- Ride types (pool, scheduled)? Real-time driver tracking? Pricing (surge)? Payments in scope? Matching goal: nearest driver or best ETA?
- Scale: drivers online, location update frequency, rides/day?

**Approach before answering**
- Core problems: **geospatial indexing** (find nearby drivers fast), **high-frequency location ingestion**, **matching with a consistent single assignment**, and **trip state machine**.

**Final answer**
- **Estimates:** 1M online drivers × update every 4 s = 250k writes/s of tiny location data (in memory, not a disk DB). 20M rides/day ≈ 230 rides/s (low).
- **Location service:** drivers push GPS via WebSocket → stored in an in-memory geo index (**Redis GEO / geohash / S2 / H3 cells**), with TTL so stale drivers disappear. Index sharded by city/cell.
- **Matching flow:** rider requests → **Ride service** queries the cell + neighbouring cells for available drivers → ranks by ETA (routing service) → offers to the top driver(s) with a timeout → driver accepts → trip created. Use a **lock/state check (compare-and-set on driver status)** so one driver is never given two rides.
- **Trip state machine:** `REQUESTED → MATCHED → ARRIVING → IN_PROGRESS → COMPLETED/CANCELLED`, persisted in a transactional DB; events on Kafka (billing, notifications, analytics).
- **Surge pricing:** per-cell demand/supply counters over a sliding window → multiplier.
- **Live tracking for riders:** driver location published to a pub/sub channel (per trip); rider's socket subscribes.
- **Payments:** separate service; authorise at request, capture at completion (see #21).

**Considerations / trade-offs**
- Geohash is simple but has boundary issues (query neighbours); S2/H3 give uniform cells.
- Dispatch batching (match every 2 s in a window to globally optimise) vs greedy nearest-driver.
- Region-partition everything by city so a failure or load spike stays local.

---

## 14. Email Delivery at Scale (transactional + bulk)

**Clarify first**
- Transactional (receipts, OTP) vs marketing? Volume per day and peak (campaign blast)? Own SMTP infrastructure or third-party (SES/SendGrid)? Tracking (opens/clicks)? Bounce handling?

**Approach before answering**
- Treat it like #7 with email-specific issues: **deliverability** (reputation, SPF/DKIM/DMARC), **bounce/complaint feedback loops**, **throttling per receiving domain**, and **priority isolation** between transactional and bulk traffic.

**Final answer**
- **Flow:** API/campaign service → validate + suppression list check (unsubscribed/bounced) → render template → **priority queues** (transactional vs bulk, separate IP pools) → **sender workers** (SMTP/API with per-ISP rate limits and retries) → provider/ISP → **event webhooks** (delivered, bounced, complained, opened, clicked) → event store + suppression updates.
- **Data:** `emails(id, to, template, status, attempts)`, `suppressions(address, reason)`, `events(email_id, type, ts)`; events to a warehouse for campaign analytics.
- **Deliverability:** dedicated IPs warmed gradually; **SPF, DKIM, DMARC**; list hygiene (remove hard bounces immediately); per-domain throttles (Gmail, Outlook limits); one-click unsubscribe headers.
- **Retries:** 4xx soft bounce → retry with backoff for ~72 h; 5xx hard bounce → suppress.
- **Scale-out:** workers autoscale on queue depth; campaigns are split into batches and rate-shaped so a 10M-recipient blast does not starve OTP emails.
- **Tracking:** open pixel + redirect-based click tracking (privacy caveats, Apple MPP inflates opens).

**Considerations / trade-offs**
- Idempotency key per logical email to avoid duplicates on retry.
- Compliance: CASL/CAN-SPAM/GDPR (consent, unsubscribe, data retention).
- Build vs buy: SES/SendGrid beats running your own MTAs unless volume is huge.

---

## 15. Search Autocomplete / Typeahead ★

**Clarify first**
- Suggest queries or entities? Personalised? Top-k count (5–10)? Latency target (<100 ms)? Update freshness (trending in minutes vs daily)? Languages? Profanity filter?

**Approach before answering**
- Core structure: a **trie with the top-k completions precomputed at each node**, built offline from query logs, served from memory/cache. Layers: client debounce + browser cache + CDN + service.

**Final answer**
- **Estimates:** 10B searches/day, ~5 keystrokes each → ~50B prefix queries/day ≈ 600k QPS peak; hence heavy caching.
- **Serving:** `GET /suggest?q=prefix` → in-memory **trie** (or Redis/Elasticsearch prefix index) where each node stores its **top-k suggestions with scores**; lookup is O(len(prefix)).
- **Data pipeline:** query logs → Kafka → aggregation (Flink/Spark): count per query per time window with **time decay** → rebuild trie snapshots hourly/daily → distribute to serving nodes; a smaller real-time path overlays trending queries.
- **Sharding:** by prefix range (e.g. first 1–2 chars, load-balanced by traffic, since "s" ≫ "x") with replicas.
- **Client optimisations:** debounce (~100–150 ms), cache results per prefix, prefetch, cancel stale requests.
- **Filtering:** blocklist, remove offensive/low-quality queries at build time.
- **Personalisation:** merge global top-k with the user's recent searches at query time.

**Considerations / trade-offs**
- Precomputing top-k per node trades memory for latency; cap the trie depth (e.g. 20 chars) and prune rare queries.
- Freshness vs cost: nightly rebuild + small real-time delta for breaking trends.
- Typo tolerance (edit distance / n-gram index) is a separate, heavier component.

---

## 16. Distributed Cache (Redis-like) ★

**Clarify first**
- Use case: cache-aside for a database, session store, or general KV? Data size, QPS, value sizes? Eviction policy? Persistence needed? Consistency expectations?

**Approach before answering**
- Three design axes: **partitioning (consistent hashing)**, **replication/failover**, **eviction (LRU/LFU) + TTL**. Then address the cache's failure modes: **stampede, penetration, avalanche, hot keys**.

**Final answer**
- **API:** `GET/SET/DEL key`, `SET key val EX ttl`.
- **Node:** in-memory hash table + doubly-linked list (LRU) or approximated LRU/LFU by sampling; lazy + periodic TTL expiry.
- **Partitioning:** **consistent hashing with virtual nodes**; clients (smart client) or a proxy tier (twemproxy-like) route; adding a node moves only ~1/N keys. (Redis Cluster uses 16,384 hash slots instead.)
- **Replication:** primary → replica (async); sentinel/cluster manager detects failure and promotes a replica; accept small data-loss window (it is a cache).
- **Population patterns:** **cache-aside** (default), write-through, write-back (risky), refresh-ahead.
- **Failure modes:** *Stampede* → per-key lock/single-flight + jittered TTLs; *Penetration* (missing keys) → cache negative results or Bloom filter; *Avalanche* (mass expiry) → randomise TTLs; *Hot key* → local in-process L1 cache or replicate the key under suffixes.
- **Monitoring:** hit ratio, evictions, memory, latency p99.

**Considerations / trade-offs**
- Invalidation is the hard part: TTL-based staleness is usually acceptable; for correctness delete-on-write (not update-on-write) to avoid races.
- Persistence (RDB/AOF) is optional; skip it for a pure cache.
- Multi-region: per-region caches with eventual invalidation via a message bus.

```ts
// Single-flight: collapse concurrent misses for the same key into one DB call
const inflight = new Map<string, Promise<unknown>>();
async function getCached<T>(key: string, load: () => Promise<T>, cache: { get(k: string): Promise<T | null>; set(k: string, v: T, ttl: number): Promise<void> }): Promise<T> {
  const hit = await cache.get(key);
  if (hit !== null) return hit;
  let p = inflight.get(key) as Promise<T> | undefined;
  if (!p) {
    p = load().then(async (v) => {
      await cache.set(key, v, 300 + Math.floor(Math.random() * 60)); // jittered TTL
      return v;
    }).finally(() => inflight.delete(key));
    inflight.set(key, p);
  }
  return p;
}
```

---

## 17. Instagram / Photo Sharing

**Clarify first**
- Photos and video? Feed, stories, explore? Likes/comments? Follower model? Scale (DAU, uploads/day)? Image sizes and retention?

**Approach before answering**
- It is **#9 (feed) + #11-style media pipeline**. Say that explicitly, then add what is photo-specific: image processing, CDN, and counters.

**Final answer**
- **Upload:** client gets a pre-signed URL → uploads original to S3 → event → **image processor** generates thumbnails/renditions (e.g. 150, 640, 1080 px, WebP/AVIF) → metadata row written → feed fan-out.
- **Data:** `photos(photo_id, user_id, s3_key, caption, ts)` sharded by user; `likes(photo_id, user_id)`/`comments` in NoSQL; **like counts** as sharded counters in Redis flushed to the DB (avoid hot-row updates on viral posts).
- **Feed:** hybrid fan-out as in #9; explore/recommendation = offline ML pipeline.
- **Delivery:** CDN for all image bytes; `srcset` so clients get the right size; blurhash placeholders.
- **Stories:** TTL (24 h) objects; separate store with expiry.
- **Search:** hashtags/users via Elasticsearch.
- **Estimates:** 100M photos/day × 2 MB original + renditions ≈ 300–400 TB/day raw; tiering to cold storage is essential.

**Considerations / trade-offs**
- Hot objects (celebrity photo) are absorbed by the CDN; counter writes are the actual bottleneck.
- Moderation pipeline (ML + human review) before wide distribution.

---

## 18. Proximity Service (Yelp / Nearby Friends)

**Clarify first**
- Static places (Yelp) or moving users (nearby friends)? Search radius options? Ranking criteria? Update frequency of locations? Scale (businesses, QPS)?

**Approach before answering**
- Choose a **spatial index**: **geohash** (string prefix → B-tree/Redis), **quadtree** (adaptive density, in-memory), or **S2/H3** cells. For mostly-static places: geohash/quadtree with a DB; for moving users: in-memory geo index (see #13).

**Final answer**
- **Estimates:** 200M businesses, 100M DAU × 5 searches ≈ 6k QPS reads; writes (new/updated places) are rare.
- **API:** `GET /search?lat=&lng=&radius=&category=`; `POST/PUT /businesses`.
- **Index:** store `geohash` (precision 5–7) per business; to search radius r: compute the geohash cell of the user at the matching precision **plus the 8 neighbours**, fetch businesses in those cells, then filter by exact distance (Haversine) and rank.
- **Data:** business details in a relational DB (read replicas) + geospatial table/index; **read replicas** handle the read-heavy load; cache hot cells in Redis; **shard by region/geohash prefix**.
- **Quadtree variant:** split cells until ≤ 100 places; in-memory per region, rebuilt nightly, hot-patched by updates.
- **Nearby friends (moving):** users publish location to a pub/sub channel; friends subscribed to that channel (only those within radius and recently active) receive updates; TTL on stale locations.

**Considerations / trade-offs**
- Geohash edge effect (adjacent cells with different prefixes) → always query neighbours.
- Dense areas (Manhattan) vs sparse (rural) favour adaptive structures (quadtree/H3 resolution by density).
- Freshness of business data is not critical → eventual consistency, cache aggressively.

---

## 19. E-commerce / Amazon Catalogue + Checkout

**Clarify first**
- Catalogue size? Marketplace (many sellers) or single retailer? Inventory accuracy requirements (no overselling)? Payments, coupons, shipping in scope? Flash-sale traffic?

**Approach before answering**
- Split into **browse/search (read-heavy, eventually consistent, cache-friendly)** and **checkout (write-critical, strongly consistent, transactional)**. Use different stores for each, and the **saga pattern** to coordinate checkout across services.

**Final answer**
- **Services:** Catalogue, Search (Elasticsearch), Cart, Inventory, Orders, Payments, Shipping, Notifications, Recommendations.
- **Catalogue/search:** product data in a document store/SQL, **indexed into Elasticsearch** via change events; heavy CDN + Redis caching for product pages; images on CDN.
- **Cart:** Redis/DynamoDB keyed by user/session with TTL; merge on login.
- **Checkout flow (saga):** create order (`PENDING`) → **reserve inventory** (atomic decrement with a reservation TTL) → **charge payment** (idempotent, see #21) → confirm order and commit inventory → emit events to Shipping/Notifications. On any failure run **compensating actions** (release stock, refund, cancel order).
- **Inventory:** the correctness hotspot: `UPDATE stock SET qty = qty - n WHERE sku = ? AND qty >= n` (or Redis Lua) to prevent overselling; reservations expire if payment is not completed.
- **Orders data:** relational (ACID), sharded by `user_id`; event log via Kafka (outbox pattern so DB write and event are atomic).
- **Flash sales:** queue-based admission (virtual waiting room), pre-warmed cache, per-SKU rate limiting, stock counters in Redis with async DB reconciliation.

**Considerations / trade-offs**
- Showing "in stock" from cache can be stale; enforce the truth only at reservation.
- Idempotent order creation (client-supplied key) to survive double-clicks and retries.
- Prices: snapshot the price at checkout time into the order.

---

## 20. Ticket Booking (Ticketmaster)

**Clarify first**
- Reserved seating or general admission? Hold time while paying? Expected peak (a Taylor Swift on-sale = millions concurrently)? Refunds/transfers? Dynamic pricing?

**Approach before answering**
- The problem is **concurrency on a scarce, finite resource** → **no double-selling**, plus a **massive burst of traffic**. Answer with: **seat holds with TTL**, **transactional/atomic state change**, and a **virtual waiting room**.

**Final answer**
- **Seat states:** `AVAILABLE → HELD (expires in ~5–10 min) → SOLD`.
- **Hold:** `UPDATE seats SET status='HELD', held_by=:user, hold_expires=now()+interval '8 min' WHERE seat_id=:id AND (status='AVAILABLE' OR hold_expires < now())` (single atomic statement; check affected rows = 1). Alternative: Redis `SET seat:{id} user NX EX 480`.
- **Purchase:** payment → on success `UPDATE ... SET status='SOLD' WHERE held_by=:user AND status='HELD'`; if the hold expired, refund/fail.
- **Expiry:** lazy (condition above) plus a sweeper job; publish "seat released" events to update seat maps.
- **Surge handling:** **virtual waiting room** (queue tokens admit N users/s into the booking flow); CDN-cache static event pages; separate read path for seat maps (cached, slightly stale) from the write path.
- **Seat map updates:** WebSocket/SSE pushes seat state changes; tolerate slight staleness, validate on hold.
- **Data:** SQL (events, venues, seats, orders), shard by `event_id` since contention is per event.
- **Fairness/anti-bot:** CAPTCHA, per-account limits, signed queue tokens.

**Considerations / trade-offs**
- Pessimistic locking (`SELECT ... FOR UPDATE`) is simple but limits throughput; optimistic conditional updates scale better.
- Best-available seat search should avoid hot-spotting the same rows (randomise within a quality tier).
- Idempotent payment and order creation (see #21).

---

## 21. Payment System / Ledger ★

**Clarify first**
- Pay-in only, or payouts too? Cards, bank transfers, wallets? Single currency or multi? Use a PSP (Stripe/Adyen) or build rails? Refunds, chargebacks, reconciliation? Compliance (PCI-DSS)?

**Approach before answering**
- Correctness over speed. Pillars: **idempotency**, **double-entry ledger**, **state machine for payments**, **asynchronous PSP integration with webhooks**, **reconciliation**. Never store raw card data; use PSP tokenisation to stay out of PCI scope.

**Final answer**
- **Flow:** Checkout → **Payment service** creates `payment(id, idempotency_key, amount, currency, status=INITIATED)` → calls **PSP** (authorise/capture) → PSP returns result or webhook later → status `AUTHORISED → CAPTURED → SETTLED` (or `FAILED/REFUNDED`) → ledger entries written → events to Orders/Notifications.
- **Idempotency:** client sends `Idempotency-Key`; unique index on it; a retry returns the stored result instead of charging twice. Also pass the key to the PSP.
- **Ledger (double-entry):** every movement = ≥2 immutable rows (debit one account, credit another) summing to zero: `ledger_entries(entry_id, txn_id, account_id, amount, direction, ts)`. Balances are derived (or cached with periodic verification). **Append-only; corrections via reversing entries**, never updates.
- **Atomicity:** payment-state change + ledger insert + outbox event in **one DB transaction** (ACID relational DB, e.g. Postgres); outbox relay publishes to Kafka reliably.
- **Webhooks:** verify signature, dedupe by event ID, process idempotently, out-of-order tolerant (state machine only moves forward).
- **Timeouts/unknown state:** if the PSP call times out, status = `PENDING_VERIFICATION`; **query the PSP** by idempotency key before retrying.
- **Reconciliation:** daily job compares internal ledger vs PSP/bank settlement files; flags mismatches for ops.
- **Security:** TLS, tokenisation, secrets in KMS/HSM, audit log, least-privilege access, fraud/risk checks (velocity rules, 3-D Secure).

**Considerations / trade-offs**
- Distributed transactions across services: use **sagas with compensations** (refund/void) rather than 2PC.
- Floats are banned: store money as integer minor units (cents) + currency code.
- Consistency over availability: it is acceptable to fail a payment; never acceptable to double-charge or lose a record.

```ts
// Idempotent create (Postgres): insert-or-return-existing
// CREATE UNIQUE INDEX ON payments (idempotency_key);
async function createPayment(db: DB, key: string, amountMinor: number, currency: string) {
  const ins = await db.query(
    `INSERT INTO payments (idempotency_key, amount_minor, currency, status)
     VALUES ($1,$2,$3,'INITIATED')
     ON CONFLICT (idempotency_key) DO NOTHING RETURNING *`,
    [key, amountMinor, currency]);
  if (ins.rows[0]) return { payment: ins.rows[0], created: true };
  const existing = await db.query(`SELECT * FROM payments WHERE idempotency_key=$1`, [key]);
  return { payment: existing.rows[0], created: false };
}
interface DB { query(sql: string, params?: unknown[]): Promise<{ rows: any[] }>; }
```

---

## 22. Multi-tenant SaaS Platform

**Clarify first**
- How many tenants (tens of enterprises vs millions of small)? Data isolation/compliance needs (regulated finance, data residency)? Per-tenant customisation (config, branding, workflows)? Noisy-neighbour tolerance? Tiered plans?

**Approach before answering**
- Choose the **tenancy model** first: *silo* (DB/stack per tenant: strongest isolation, highest cost), *pool* (shared schema with `tenant_id`: cheapest, needs strict guards), *bridge* (schema-per-tenant or mixed). Many real systems are **hybrid**: pooled for small tenants, siloed for large/regulated ones.

**Final answer**
- **Tenant identification:** from subdomain/JWT claim → tenant context propagated through every request, log and event.
- **Data isolation:** pooled DB with `tenant_id` on every table + **row-level security (Postgres RLS)** so a missing `WHERE` cannot leak data; composite indexes starting with `tenant_id`; large tenants move to dedicated shards/DBs; shard routing via a **tenant → shard directory**.
- **AuthN/Z:** SSO/SAML/OIDC per tenant, RBAC per tenant; tenant-scoped API keys.
- **Noisy neighbours:** **per-tenant rate limits and quotas**, per-tenant connection pools, background-job fair queues (weighted round-robin), and optional dedicated compute for premium tiers.
- **Customisation:** per-tenant config + feature flags (rollouts per tenant), configurable workflows/fields via metadata schema (JSONB/EAV) rather than schema changes.
- **Operations:** tenant-aware observability (metrics/logs tagged with `tenant_id`), per-tenant backup/restore, tenant onboarding/offboarding automation (data export/deletion), cost attribution per tenant.
- **Releases:** progressive rollout (canary a few tenants), feature toggles, safe migrations (expand/contract), rollback plan.

**Considerations / trade-offs**
- Pooled model risks: cross-tenant leakage (mitigate with RLS + tests), noisy neighbours, harder per-tenant restore.
- Silo model risks: operational sprawl (1,000 databases), migration orchestration cost.
- Data residency: route tenants to region-specific stacks; keep the tenant directory global but data local.
- Talking point: tenant management module, feature toggles, rollback strategy, and throttling.

---

# HARD

## 23. Google Docs / Real-time Collaborative Editing

**Clarify first**
- Max concurrent editors per doc? Rich text or plain text? Offline editing? Version history and comments? Latency target (<100 ms perceived)? Document size?

**Approach before answering**
- The core problem is **merging concurrent edits so all replicas converge**. Two families: **Operational Transformation (OT)**, central server serialises and transforms ops (Google Docs); **CRDTs** (Yjs, Automerge), ops commute so no central ordering is needed (better for offline/P2P). Pick one and explain why. For a typical interview: OT with a central server per document, or CRDT if offline is a requirement.

**Final answer**
- **Connection:** each client holds a **WebSocket** to a **collaboration server**; all editors of one document are routed to the **same server (sticky by `docId`)** so ordering is trivial.
- **Edit flow (OT):** client applies the edit locally immediately (optimistic), sends `op(baseRevision)` → server **transforms** it against ops committed since `baseRevision`, assigns the next revision, appends to the op log, **broadcasts** the transformed op to other clients, and acks the sender. Clients transform incoming remote ops against their unacked local ops.
- **Storage:** append-only **op log** per document (Cassandra/Postgres) + periodic **snapshots** (every N ops) for fast load; load = latest snapshot + replay ops after it. Version history = snapshots/ops by revision.
- **Presence/cursors:** ephemeral state via pub/sub (not persisted); coalesce updates (e.g. 10/s).
- **Scaling:** documents are the shard unit; consistent hashing assigns `docId → collab server`; a registry handles reassignment on failure (clients reconnect and resync from their last revision).
- **Permissions/comments:** separate services; checked at connection time and on each op.
- **CRDT alternative:** each character gets a globally unique, ordered ID (e.g. RGA/Logoot); inserts/deletes reference IDs, so merges are commutative; memory overhead (tombstones) managed via garbage collection.

**Considerations / trade-offs**
- OT is hard to get right for rich text (many transform functions); CRDTs cost more memory but are simpler to reason about and support offline.
- Failure: server crash → rebuild from op log; client offline → rebase on reconnect.
- Hot docs (10k viewers): editors on the collab server, viewers served from a read-only replica/fan-out tier.

---

## 24. Distributed Message Queue (Kafka-like)

**Clarify first**
- Delivery semantics (at-most / at-least / exactly-once)? Ordering guarantee? Throughput and retention (days, forever)? Number of producers/consumers? Pub/sub with consumer groups?

**Approach before answering**
- Model it as a **partitioned, replicated, append-only log**. Everything else (ordering, scaling, replay, consumer groups) follows from that. Name the trade-off: ordering is **per partition**, not global.

**Final answer**
- **Concepts:** **topic** → N **partitions** (unit of parallelism and ordering) → each partition is an ordered, immutable log of **segments** on disk; each message has an **offset**.
- **Producer:** picks partition by key hash (same key → same partition → ordered) or round-robin; batches and compresses; `acks=all` for durability; **idempotent producer** (producer ID + sequence number) avoids duplicates on retry.
- **Broker storage:** sequential disk writes + OS page cache + zero-copy `sendfile` = very high throughput; old segments deleted by time/size or **compacted** by key.
- **Replication:** each partition has a **leader** and followers; **ISR** (in-sync replicas) must ack; on leader failure a controller (Raft/ZooKeeper) elects a new leader from the ISR. `min.insync.replicas` trades availability for durability.
- **Consumers:** **consumer groups**: each partition is consumed by exactly one consumer in the group; consumers track **committed offsets** (stored in an internal topic); rebalance when members join/leave. Replay = reset offset.
- **Delivery semantics:** at-least-once by default (commit after processing); exactly-once with transactions (atomic write of output + offsets) in Kafka-to-Kafka pipelines; otherwise make consumers **idempotent**.
- **Scaling:** add partitions/brokers; partition count ≥ max consumer parallelism. Metadata via a controller quorum.
- **Back-pressure:** consumers pull (not push), so slow consumers just lag; monitor consumer lag.

**Considerations / trade-offs**
- More partitions = more parallelism but more open files, longer failover, and weaker ordering scope.
- Hot partitions from skewed keys; use composite keys or salting.
- Queue (SQS/RabbitMQ: per-message ack, deletion, priority) vs log (Kafka: replay, ordering per partition, massive throughput): pick by need.

---

## 25. Distributed Job Scheduler / Workflow Engine

**Clarify first**
- One-time, delayed, and cron jobs? Scale (jobs/s, total scheduled)? Job duration (seconds vs hours)? Retries/priorities/dependencies (DAGs)? At-least-once or exactly-once? Multi-tenant?

**Approach before answering**
- Separate **scheduling (deciding *when*)** from **execution (running)**. Core issues: **no job lost, no job run twice by accident, workers die mid-job**, and **scale of timers**. Use leases/heartbeats and idempotent jobs.

**Final answer**
- **API:** `POST /jobs {type, payload, runAt | cron, retryPolicy, priority, idempotencyKey}`, `GET /jobs/{id}`, `DELETE /jobs/{id}`.
- **Storage:** `jobs(id, status, run_at, payload, attempts, lease_owner, lease_expires, priority, tenant)`; indexed on `(status, run_at)`. Shard by `job_id`/tenant.
- **Scheduler tier:** polls for due jobs (`WHERE status='SCHEDULED' AND run_at <= now() ORDER BY priority, run_at LIMIT N FOR UPDATE SKIP LOCKED`), marks them `QUEUED`, and enqueues to the execution queue. Multiple schedulers run safely thanks to `SKIP LOCKED` (or partition-ownership via leader election). For very large timer counts use **hierarchical timing wheels** or a time-bucketed (per-minute) index.
- **Execution:** workers pull from queues (per priority/type), **claim a lease**, run the job, and **heartbeat**; on completion mark `SUCCEEDED`. If the lease expires (worker died), a reaper re-queues the job, so semantics are **at-least-once** → jobs must be **idempotent** (use the job ID as dedupe key downstream).
- **Retries:** exponential backoff with jitter, max attempts, then **dead-letter queue** and alert.
- **Cron:** a recurring job row computes `next_run_at` after each run (store the cron expression and timezone; beware DST).
- **Workflows/DAGs:** store dependencies; a job becomes runnable when all parents succeed (state machine like Airflow/Temporal); persist workflow state so it can resume after crashes.
- **Observability:** queue depth, lateness (`now - run_at`), failure rate, per-tenant usage; manual retry/cancel UI.

**Considerations / trade-offs**
- Exactly-once execution is impossible in general; at-least-once + idempotency is the practical answer.
- Clock skew: use DB time as the single source of truth for `now()`.
- Fairness across tenants: weighted queues so one tenant's 1M jobs do not starve others.
- Build vs buy: Temporal/Airflow/Quartz/SQS delayed messages cover most needs.

---

## 26. Metrics / Monitoring and Alerting System (Datadog-like)

**Clarify first**
- Metrics only, or logs and traces too? Number of hosts and metrics per host? Collection interval (10 s)? Retention and rollups (raw 15 days, 1-min for 1 year)? Alert latency target? Push or pull collection?

**Approach before answering**
- It is a **write-heavy time-series workload** with **append-only data, time-range reads, and downsampling**. Design for **ingestion throughput**, a **time-series database (TSDB)**, **rollups**, and a **rule-evaluation alert pipeline**.

**Final answer**
- **Estimates:** 100k hosts × 100 metrics / 10 s = 1M datapoints/s ≈ 86B/day; ×16 B ≈ 1.4 TB/day raw.
- **Collection:** agents push (or a collector pulls, Prometheus-style) → **load balancer → ingestion gateway** (auth, validate, tag) → **Kafka** (buffer, replay, back-pressure) → **TSDB writers**.
- **Storage:** TSDB (Gorilla/Prometheus/VictoriaMetrics/M3/Influx): data keyed by `(metric name, tag set)` series ID + time; **delta-of-delta timestamps and XOR value compression** (~1.4 B/point); partitioned by time and series hash; **tiered retention with rollups** (raw → 1 min → 1 h).
- **Query:** query service (PromQL-like) hits hot data in memory/SSD, older rollups on cheap storage; **cache dashboards' common queries**; limit cardinality.
- **Cardinality control:** the real killer: unbounded tag values (user IDs) explode series counts; enforce limits/quotas per tenant.
- **Alerting:** **rule evaluator** runs queries on a schedule (e.g. every 30 s) against recent data, tracks state (`OK → PENDING → FIRING`, with `for: 5m` to prevent flapping) → **alert manager** dedupes, groups, silences, routes to PagerDuty/Slack/email, with escalation policies.
- **HA:** replicated ingestion and storage; alerting evaluated by redundant instances with dedupe; the monitoring system must monitor itself and survive the outages it detects.

**Considerations / trade-offs**
- Push vs pull: pull simplifies discovery/health detection; push suits short-lived jobs and firewalled hosts.
- Accuracy vs cost via rollups (percentiles cannot be re-aggregated; store histograms/sketches such as t-digest/HDR).
- Alert quality: symptom-based alerts, SLO burn-rate alerting to reduce noise.

---

## 27. Stock Exchange / Order Matching Engine

**Clarify first**
- Asset class and order types (market, limit, cancel, IOC/FOK)? Latency target (µs–ms)? Throughput (orders/s)? Strict fairness (price-time priority)? Regulatory auditing and recovery requirements?

**Approach before answering**
- The heart is a **single-threaded, deterministic matching engine per symbol** with an **in-memory order book**, fed by an **ordered, durable input log**. Determinism enables **replay for recovery and hot standby**. Concurrency is avoided on purpose.

**Final answer**
- **Order book (per symbol):** two sides: **bids** (max price first) and **asks** (min price first); each price level is a FIFO queue (**price-time priority**). Data structures: sorted map/heaps of price levels + hash map `orderId → node` for O(1) cancel.
- **Matching:** incoming limit order crosses the book while prices overlap, generating **trades** (execution price = resting order's price); remainder rests in the book; market orders walk the book. Complexity O(log P) per new price level, O(1) per fill/cancel.
- **Pipeline:** Clients → **gateway** (FIX/auth, validation) → **risk checks** (credit/margin, fat-finger limits) → **sequencer** (assigns global sequence numbers, writes to a **replicated, durable log**: e.g. Raft/Aeron) → **matching engine** (one thread per symbol shard) → **trade/market-data publisher** (multicast feed) + **order status to gateway**; downstream **clearing/settlement**, **reporting**, **audit**.
- **Determinism & recovery:** engine state = pure function of the sequenced input log. **Primary + hot standbys** process the same log; failover = promote a standby; cold restart = snapshot + log replay.
- **Scaling:** shard by **symbol** (each engine independent); no cross-symbol ordering needed.
- **Latency:** in-memory, lock-free ring buffers (LMAX Disruptor), kernel bypass, pinned cores; avoid GC/allocations on the hot path (this is why many are C++/Java/Rust).
- **Market data:** snapshots + incremental updates; fan-out via multicast/WebSocket gateways.

**Considerations / trade-offs**
- Fairness vs throughput: strict single-writer per symbol caps per-symbol throughput but guarantees fairness and correctness.
- Money-critical: exactly-once effect via sequence numbers and idempotent downstream processing; full audit trail of every order event.
- Circuit breakers/halts for extreme volatility.

---

## 28. Global Distributed Database / Distributed Lock Service

**Clarify first**
- Which one: a **globally replicated database** (Spanner/CockroachDB-like) or a **lock/coordination service** (ZooKeeper/etcd/Chubby-like)? Consistency required (linearizable)? Multi-region writes? Latency vs consistency preference? Scale?

**Approach before answering**
- Both rest on **consensus (Paxos/Raft)**. State the CAP/PACELC position up front: **CP**: during a partition the minority side cannot make progress. Then build up: replication group → sharding into many consensus groups → transactions across groups → global time.

**Final answer (global database)**
- **Sharding:** data split into **ranges/tablets**; each range is a **Raft group** (3–5 replicas spread across zones/regions) with a leader that serves writes and (lease-based) consistent reads.
- **Single-range writes:** leader appends to log → replicates to a majority → commits → applies. Tolerates minority failures; leader election on failure.
- **Cross-range transactions:** **two-phase commit across Raft groups** (each participant is highly available because it is replicated), coordinated by a transaction record; Spanner adds **TrueTime** (bounded clock uncertainty with commit-wait) for externally consistent timestamps; CockroachDB uses hybrid logical clocks + uncertainty intervals.
- **Reads:** *strong* reads go to the leaseholder; *stale/follower* reads (bounded staleness) served from the nearest replica for low latency; **MVCC** enables snapshot reads without blocking writers.
- **Geo placement:** pin replicas/leaders near users (e.g. EU data stays in EU); locality-aware leaseholder placement; cost: cross-region write latency = RTT to a majority.
- **Rebalancing:** ranges split when large/hot and move across nodes automatically.

**Final answer (distributed lock service)**
- **Core:** a small replicated **Raft/ZAB cluster** (3 or 5 nodes) exposing a linearizable KV with **leases and watches**.
- **Lock acquire:** create an ephemeral node/key with a **TTL lease**; holder renews via heartbeat; if it dies, the lease expires and the lock is released. Waiters **watch** the predecessor (avoid thundering herd).
- **Fencing tokens:** every lock grant returns a **monotonically increasing token**; the protected resource rejects writes with an older token. This is what makes it safe against a paused client (GC pause) that *thinks* it still holds the lock.
- **Leader election, config, service discovery** are built on the same primitives.

**Considerations / trade-offs**
- Latency floor: commit needs a quorum round trip; multi-region quorums cost 50–150 ms; place a majority in nearby regions if latency matters.
- Redlock (Redis) is controversial for correctness; for safety-critical locks use a consensus system plus fencing tokens.
- Lease durations: short = quick failover but risk of false expiry; long = slow recovery.
- Availability: majority needed; 2-region deployments cannot survive losing the majority region; use 3 regions.

---

# AI / LLM SYSTEM DESIGN

*Anchor each answer in a system you have actually built or studied (agent loops, hybrid vector + keyword retrieval, re-ranking, cited streaming answers, prompt-injection defences, per-tenant spend caps, tests against a mock LLM).*

## 29. Enterprise RAG Chatbot over Internal Documents ★

**Clarify first**
- Data sources (PDF, Confluence, SharePoint, tickets, DBs)? Volume and update frequency? **Permissions**: must answers respect per-user document ACLs? Required accuracy and citation requirements? Latency (first token <2 s)? Languages? Hosting/data-residency limits (can data go to an external LLM API)? Multi-tenant?

**Approach before answering**
- Two pipelines: **offline ingestion** (parse → chunk → embed → index) and **online query** (rewrite → retrieve → re-rank → generate with citations → verify). The biggest design levers are **retrieval quality** and **permission-aware filtering**, not the LLM. Define an **evaluation plan** before building.

**Final answer**
- **Ingestion:** connectors with incremental sync (webhooks/change feeds) → parsers (layout-aware PDF/HTML, OCR if needed) → **chunking** (structure-aware by headings/sections, ~300–800 tokens, 10–15% overlap; keep parent-document pointer and metadata: source, title, section, ACL, updated_at, tenant) → **embeddings** → store in a **vector DB** (pgvector/Pinecone) **plus a keyword index** (BM25/Postgres FTS/Elasticsearch). Dedupe and version chunks; re-embed on change; tombstone deleted docs.
- **Query path:**
  1. **AuthN → ACL filter** built from user/group claims (applied *inside* the retrieval query as a metadata filter, never post-hoc after generation).
  2. **Query understanding:** rewrite/condense using chat history; optional decomposition for multi-part questions.
  3. **Hybrid retrieval:** vector top-50 + BM25 top-50 → merge via **Reciprocal Rank Fusion**.
  4. **Re-rank** with a cross-encoder to top ~5–8.
  5. **Prompt assembly:** system rules + retrieved chunks (clearly delimited as untrusted data) + question, fitted to a **context budget**.
  6. **Generate** with streaming; require **inline citations** (chunk IDs mapped to source links).
  7. **Post-checks:** citation validity, groundedness/“I don’t know” fallback when retrieval confidence is low, PII/safety filters.
- **Agentic RAG (when needed):** a bounded loop (LangGraph) that can reformulate, call a different retriever/tool, or ask a clarifying question; hard caps on steps, tokens and cost.
- **Caching:** semantic cache for repeated questions (with ACL-scoped keys), prompt caching for static prefixes, embedding cache.
- **Feedback:** thumbs up/down, “no answer” logging, and failed-query analysis feeding the eval set.
- **Evaluation (offline + online):** golden set of Q&A with expected sources; **retrieval metrics** (recall@k, MRR, nDCG), **generation metrics** (faithfulness/groundedness, answer relevance, citation accuracy; LLM-as-judge calibrated against human labels); run in CI as a **regression gate** on every prompt/chunking/model change. (Your 90%+ retrieval accuracy result is the proof point.)

**Considerations / trade-offs**
- Chunk size: small = precise but loses context; large = noisy. Parent-document retrieval gives both.
- Fresh vs cheap: incremental indexing vs periodic full rebuild.
- **Security:** prompt injection through retrieved documents (treat as data, strip instructions, no tool access from retrieved text), exfiltration via markdown links/images, tenant isolation of indexes.
- Cost/latency: re-ranking and long contexts dominate; tune top-k, cache, and consider smaller models for rewrite/classification steps.
- Hallucination mitigation: grounded prompts, citations required, abstain below a retrieval-score threshold.

```ts
// Reciprocal Rank Fusion: merge ranked lists from vector + BM25 retrievers
function rrf(lists: string[][], k = 60): string[] {
  const score = new Map<string, number>();
  for (const list of lists)
    list.forEach((id, rank) => score.set(id, (score.get(id) ?? 0) + 1 / (k + rank + 1)));
  return [...score.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}
```

---

## 30. LLM-powered Customer Support Agent ★

**Clarify first**
- Channels (chat, email, voice)? What actions may it take (read-only vs refunds/account changes)? Escalation rules and human handoff? Languages? Target deflection rate and CSAT? Compliance/audit requirements? Latency expectations?

**Approach before answering**
- Combine **RAG for knowledge** with **tool calling for actions**, wrapped in **guardrails, escalation, and evaluation**. Autonomy should be **graduated**: read-only first, write actions behind confirmation/approval. Put the *risk classification of each action* at the centre.

**Final answer**
- **Flow:** user message → **gateway** (auth, rate limit, PII redaction) → **intent/risk classifier** (cheap model or rules: FAQ / account-specific / action / sensitive-escalate) → **orchestrator** (bounded agent loop, e.g. LangGraph) → tools → **response guard** → user.
- **Tools (function calling):** `search_kb` (RAG), `get_order_status`, `get_account_summary`, `create_ticket`, `issue_refund` (write), `handoff_to_human`. Each tool: strict JSON schema, **server-side authorisation using the end user’s identity** (the model never decides who it is acting as), input validation, timeouts, idempotency keys, and audit logging.
- **Guardrails:** policy prompt + deterministic checks: refund limits enforced in code, **human-in-the-loop approval** above thresholds, topic restrictions, PII handling, prompt-injection defences (tool results and user text are untrusted data), structured outputs validated with schemas (Zod/Pydantic), max steps/tokens/cost per conversation.
- **Escalation:** triggers on low confidence, repeated failure, negative sentiment, legal/safety keywords, or explicit request; passes a **conversation summary + context + attempted steps** to the human queue so the customer does not repeat themselves.
- **Memory:** short-term = conversation window (summarised when long); long-term = customer profile/previous tickets retrieved by ID, not stuffed wholesale.
- **Observability:** full traces (prompt, tool calls, latencies, tokens, cost), conversation outcome labels, redaction in logs.
- **Evaluation:** replay historical tickets as a test set; scenario tests for adversarial cases; metrics: resolution rate, escalation precision, hallucination/incorrect-action rate, CSAT, cost per resolution; canary rollout and shadow mode (agent drafts, human sends) before autonomy.

**Considerations / trade-offs**
- Safety vs deflection: stricter guardrails lower automation but protect trust.
- Model choice: small/fast model for routing, larger for reasoning; fallbacks when the provider is down (degrade to FAQ/human).
- Latency: stream tokens, parallelise independent tool calls, cache static knowledge.

---

## 31. Multi-tenant LLM Gateway ★

**Clarify first**
- Which providers/models (Anthropic, OpenAI, self-hosted)? Tenants and internal consumers? Required controls: auth, quotas, budgets, PII policies, audit? Streaming support? Latency overhead budget? Data-residency requirements?

**Approach before answering**
- A **proxy layer** between all applications and model providers that centralises **auth, routing, rate/spend limits, caching, safety, observability, and failover**. Designing it well means treating **tokens, not requests**, as the unit of cost and limit.

**Final answer**
- **API:** OpenAI/Anthropic-compatible `POST /v1/messages` (streaming via SSE) so apps switch with a base-URL change; **virtual API keys** per tenant/app/environment.
- **Request pipeline (middleware chain):** authenticate (key → tenant, policies) → **validate and size-estimate** (token count) → **rate limit** (RPM + TPM, token-bucket in Redis, per tenant/model) → **budget check** (reserve estimated cost against the tenant's monthly/daily cap; reconcile with actual usage after the response) → **input guardrails** (PII redaction, prompt-injection/abuse filters, allow-lists) → **cache lookup** (exact-match; optional semantic) → **router** → provider call (streamed) → **output guardrails** → **usage metering** → response.
- **Routing:** by model alias (`fast`, `smart`), cost, latency, region/data-residency, capability (tools, vision); **fallback chains** on 429/5xx/timeouts (e.g. primary provider → secondary), **circuit breakers** per provider/model, **retry with jittered backoff**, hedged requests for tail latency (carefully, they cost money).
- **Caching:** exact-match response cache (hash of model+params+messages) for deterministic calls; provider **prompt caching** for long static prefixes; semantic cache only where staleness/risk is acceptable, with tenant-scoped keys.
- **Metering and billing:** every call emits an event `{tenant, app, model, input_tokens, output_tokens, cached_tokens, latency, cost, status}` to Kafka → warehouse; real-time counters in Redis for caps; dashboards/alerts on spend anomalies. (Your per-tenant spend caps map directly here.)
- **Streaming nuance:** token usage is only known at the end; reserve a conservative estimate up-front, settle afterwards; cancel the upstream request if the client disconnects.
- **Control plane vs data plane:** config (tenants, keys, policies, prices) in a DB with push/poll cache to gateways; gateways are **stateless and horizontally scaled** behind a load balancer.
- **Security:** secrets for provider keys in a vault, never exposed to clients; mTLS internally; audit logs with redaction; tenant isolation of cache and logs; per-tenant data-retention settings (zero-retention).

**Considerations / trade-offs**
- Added latency (aim <10–20 ms overhead): keep checks in-memory/Redis; do heavy work asynchronously.
- Failover across providers changes behaviour; normalise tool/message formats, and make fallback model selection explicit.
- Build vs buy: LiteLLM, Portkey, Helicone, Kong AI Gateway; build when you need custom policy/billing.

---

## 32. Agentic Workflow Platform

**Clarify first**
- What kinds of agents (research, coding, back-office automation)? Long-running (minutes/hours/days)? Human approval steps? Which tools/integrations? Multi-tenant? Reliability and audit requirements? Budget controls?

**Approach before answering**
- Model an agent run as a **durable, resumable state machine/graph** (not a single in-memory loop). Key properties: **persisted state with checkpoints, bounded autonomy (budgets, step limits), tool sandboxing, human-in-the-loop, idempotent tool calls, and full tracing.**

**Final answer**
- **Components:** **Workflow API** (create/inspect/cancel runs) → **Orchestrator** (graph engine, e.g. LangGraph/Temporal-style) → **Worker pool** (executes nodes: LLM calls, tool calls) → **Tool registry/gateway** (schemas, auth, sandbox, rate limits) → **State store** (Postgres: run, steps, messages, checkpoints) → **Queue** → **Event stream/trace store** → **Approval service** → **LLM gateway** (#31).
- **Execution model:** graph of nodes (planner → executor → verifier → …) with **conditional edges**; after every node, the full state is **checkpointed**; a crashed/paused run **resumes from the last checkpoint**; steps are executed as queue jobs with leases (see #25) and **idempotency keys** for side-effecting tools.
- **Control:** hard limits on **steps, tokens, wall-clock, and spend per run and per tenant**; loop/stall detection (repeated identical tool call); **kill switch**.
- **Human-in-the-loop:** nodes can `interrupt` and wait for approval (email/Slack/UI), with timeout policy (auto-reject/escalate); approvals are logged and part of the state.
- **Tools and safety:** least-privilege credentials per run, **sandboxed code execution** (containers/gVisor/Firecracker, no network by default), allow/deny path & command guards, content from tools treated as untrusted (prompt-injection defence), outputs schema-validated.
- **Multi-agent patterns:** supervisor delegating to specialist sub-agents with **scoped context** and returning **compact summaries** (context management); parallel branches for independent subtasks; reviewer/critic step with test gates before completion. (This is what your Claude Code subagent pipeline does: planner, implementer, test-writer, reviewer, security-auditor under budget guards and hooks.)
- **Memory/context:** working memory (current run), scratchpad files/specs, long-term memory (vector/KV, retrieval on demand); summarise and prune to stay within context windows.
- **Observability and eval:** trace each step (prompt, tool I/O, tokens, cost, latency), replay a run deterministically from recorded tool outputs, scenario-based evals, success-rate and cost-per-task dashboards.

**Considerations / trade-offs**
- Autonomy vs reliability: more structure (explicit graphs) beats free-form loops for production; use free-form only where flexibility pays.
- Cost explosion from loops: budgets are mandatory, not optional.
- Determinism for tests: mock LLM and recorded fixtures (a large suite against a mock LLM).

---

## 33. Semantic Search / Recommendation System

**Clarify first**
- Corpus size (millions vs billions of items) and update rate? Query types (text, image, personalised)? Latency target? Need hybrid keyword matching (exact terms, SKUs)? Cold-start items/users? Business rules/filters (in-stock, region)?

**Approach before answering**
- Standard industrial pattern: **multi-stage funnel**: cheap **candidate generation** (ANN over embeddings + keyword) → **ranking** (heavier model with rich features) → **re-ranking/business rules**. Recommendations reuse the same funnel with user/item embeddings.

**Final answer**
- **Embeddings:** text/image encoders (sentence-transformers, CLIP, or provider embeddings); for recommendations a **two-tower model** (user tower, item tower) trained on interactions so that dot product ≈ relevance. Version embeddings and re-embed on model change (blue/green index).
- **Index:** **ANN index** (HNSW, IVF-PQ via FAISS/ScaNN, or a vector DB such as pgvector/Pinecone/Milvus/Qdrant). HNSW: high recall, more memory; IVF-PQ: compressed for billions. Support **metadata filters** (pre-filter or filtered HNSW). Shard by item partition, replicate for QPS.
- **Serving path:** query → embed (cache) → **ANN top-200** (+ BM25 top-200, fuse) → fetch features → **ranker** (GBDT/neural, ~50–100 ms) → business rules/diversity/dedupe → top-k.
- **Freshness:** streaming upserts for new items (near-real-time index segments), periodic compaction; delete handling via tombstones.
- **Personalisation:** user embedding from recent behaviour (computed in a **feature store**, online/offline consistency); session-based signals update in real time.
- **Cold start:** content-based embeddings for new items; popularity/exploration (bandits) for new users.
- **Feedback loop:** log impressions, clicks, conversions → training data → periodic retrain; **A/B testing** with guardrail metrics.
- **Metrics:** offline recall@k/nDCG; online CTR, conversion, dwell time, diversity, latency p99.

**Considerations / trade-offs**
- ANN recall vs latency vs memory (tune `efSearch`, `M`, nprobe).
- Exact-match terms (product codes) are poorly handled by dense vectors, so keep a lexical path (hybrid).
- Popularity bias and filter bubbles: add exploration and diversity re-ranking.

---

## 34. LLM Evaluation and Monitoring Pipeline

**Clarify first**
- Which LLM features are covered (RAG, agents, classification, summarisation)? Quality dimensions that matter (accuracy, faithfulness, tone, safety, cost, latency)? Do we have labelled data? Release cadence and gating needs? Compliance/audit?

**Approach before answering**
- Two loops: **offline evaluation (pre-release gate)** and **online monitoring (post-release)**, linked by a **data flywheel**: production failures become new test cases. Be explicit that LLM evals are *statistical*, so use sample sizes, confidence intervals, and calibrated judges.

**Final answer**
- **Datasets:** **golden set** (curated Q/expected answer/sources, per feature and per slice: easy/hard/adversarial/edge languages), **regression set** (every past bug), **synthetic set** (LLM-generated variations, human-reviewed), versioned in Git/DVC.
- **Evaluators:** *Deterministic* (schema validity, exact/regex match, citation presence, tool-call correctness, latency, cost); *Reference-based* (similarity, ROUGE/BERTScore, retrieval recall@k, MRR); *LLM-as-judge* with rubric prompts (faithfulness, relevance, safety, helpfulness), **calibrated against human labels** (measure agreement, e.g. Cohen’s κ) and defended against judge biases (position, verbosity; randomise order, use a different/stronger model than the system under test); *Human review* for a sampled slice.
- **CI integration:** every change to prompts, retrieval config, model version, or code runs the eval suite; **regression gate** (e.g. faithfulness must not drop >2 pts, no new failures on the critical set); results posted to the PR; use a **mock LLM** for deterministic unit tests of orchestration code and real-model evals nightly/pre-release.
- **Release strategy:** shadow mode → canary (5% traffic) → full; A/B tests with guardrail metrics; fast rollback via prompt/model version flags.
- **Online monitoring:** trace every request (inputs, retrieved context, outputs, tool calls, tokens, latency, cost) → store with PII redaction; dashboards for **quality proxies** (thumbs, escalation rate, refusal rate, citation click-through, groundedness score on a sampled 1–5% via async LLM judge), **safety signals** (jailbreak/injection detections, toxicity), **operational** (p50/p95 latency, error/timeout rate, token usage, cost per request/tenant), and **drift** (query-topic distribution, embedding drift, retrieval-score distribution, model-provider version changes).
- **Alerts:** thresholds and anomaly detection on quality proxies and cost; on-call runbooks.
- **Flywheel:** low-rated or flagged traces → triage UI → label → add to golden/regression sets → fix → verify through the gate.

**Considerations / trade-offs**
- Judge cost: run cheap deterministic checks on 100% of traffic, LLM-judge on samples.
- Non-determinism: temperature 0 for evals where possible, repeat runs to measure variance.
- Overfitting to the golden set: refresh it continuously with production samples; hold out a blind set.
- Tools: LangSmith, Langfuse, Arize Phoenix, Ragas, DeepEval, Braintrust, or in-house.

---

## 35. Code-Review / Coding-Agent System

**Clarify first**
- Review-only (comment on PRs) or also write/fix code? Which languages/repos and size? Must it run tests/build? Where does code live (GitHub/GitLab) and what are the security constraints (code cannot leave the VPC)? Latency (minutes OK)? Acceptable noise level?

**Approach before answering**
- The design hinges on **context management** (a large repo does not fit in a prompt), **safe execution** (sandbox), and **verification** (tests/linters/type-checkers as ground truth), plus **precision over recall** for review comments (noisy bots get ignored).

**Final answer**
- **Trigger:** webhook on PR open/update → **job queue** → **agent worker** in an **ephemeral sandbox** (container/microVM) with a shallow clone at the PR's head, **no secrets and restricted network**.
- **Context building:** diff + changed files + **repo map** (symbols/dependencies via tree-sitter/LSP), **retrieval** of related code (embeddings + grep + call graph), project conventions (CLAUDE.md-style rules, linters config), linked ticket/spec; scoped **subagents** (security, tests, performance, style) each with a narrow context and a compact summary returned to the coordinator.
- **Agent loop (bounded):** plan → read code (tools: read/grep/search) → run static analysis, type-check, and tests inside the sandbox → hypothesise issues → **verify each finding** (reproduce with a test or trace the code path) → produce comments with file/line, severity, rationale, and a suggested patch.
- **For fixing code:** make changes on a branch, run the test suite as a **gate**, iterate with a step/budget cap, open a PR (never push to protected branches), human approval required to merge.
- **Quality controls:** de-duplicate against existing comments, rank by confidence/severity, post only the top N, track **accept/dismiss rates** per rule to tune; allow `/ignore` suppressions.
- **Security:** treat repo content as **untrusted** (prompt injection in code comments/READMEs), command/path allow-lists, no network egress or allow-list only, secret scanning of agent output, per-run credential scoping, full audit log; hooks that block dangerous commands (as in your Claude Code guard hooks).
- **Observability and cost:** tokens/cost per PR, latency, comment acceptance rate, false-positive rate; budget caps per repo/org.
- **Evaluation:** benchmark on historical PRs with known bugs (precision/recall of findings), SWE-bench-style tasks for fix quality.

**Considerations / trade-offs**
- Large PRs: chunk by file/module, review in parallel, then synthesise; skip generated/vendor files.
- Determinism: pin tool versions in the sandbox image; cache dependencies for speed.
- Human-in-the-loop remains for merge decisions; measure time saved.

---

## 36. Real-time Document Summarisation / Transcription Pipeline

**Clarify first**
- Input type (live audio/meetings, uploaded audio/video, documents)? Real-time (captions in <1 s) or near-real-time (summary after the meeting)? Volume (concurrent streams, hours/day)? Languages and speaker diarisation? Accuracy needs and PII/compliance (HIPAA/GDPR)? Output formats?

**Approach before answering**
- Split into **streaming ASR** (low-latency, partial results) and **summarisation** (LLM, chunked, hierarchical). Control **cost** (ASR and LLM tokens dominate) and **backpressure** with queues; keep an **audit-friendly transcript** as the source of truth.

**Final answer**
- **Live path:** client captures audio → **WebSocket/WebRTC** → **ingest gateway** → **streaming ASR** (Whisper-streaming/Deepgram/Google STT; **VAD** to skip silence) → partial/final transcript segments streamed back to the client and published to a **Kafka topic keyed by `sessionId`** (preserves order).
- **Batch path:** upload to object storage → event → **transcode (ffmpeg → 16 kHz mono)** → chunk by silence/time with overlap → **ASR workers** (GPU, autoscaled on queue depth, parallel per chunk) → stitch with timestamps → **diarisation** (speaker labels) → store transcript (object store + searchable index).
- **Summarisation:** *Streaming/rolling*: every N seconds or at topic shifts, summarise new transcript segments and merge into a running summary (**incremental/refine** strategy). *Final/long documents*: **map-reduce** — split into chunks (by speaker turns/sections) → summarise each in parallel (small, cheap model) → **reduce** into a final summary/action items/decisions (stronger model); use structured output (JSON schema: summary, decisions, action items with owners/dates).
- **Grounding:** each summary point links back to transcript timestamps (verifiability); instruct the model to **not invent** names/dates; validate JSON; optional faithfulness check.
- **Storage and API:** `sessions`, `transcript_segments(session_id, seq, start_ms, end_ms, speaker, text)`, `summaries(version, …)`; REST + WebSocket for live updates; search over transcripts (BM25/embeddings).
- **Scaling:** stateless gateways; ASR pool autoscaled by concurrent streams (GPU-bound), queues absorb spikes; **idempotent segment processing** (dedupe by `(session, seq)`).
- **Privacy:** encryption in transit/at rest, PII redaction before sending to external LLMs, retention policies, per-tenant keys, consent for recording.

**Considerations / trade-offs**
- Latency vs accuracy: partial hypotheses change; show them greyed until finalised.
- Cost control: VAD, model tiering, caching, summarise on schedule rather than on every sentence.
- Long meetings exceed context windows → hierarchical summarisation, not one giant prompt.
- Failure modes: ASR errors on names/jargon (custom vocabulary/glossary), overlapping speakers, dropped network (client buffers and resumes by sequence number).

---

## 37. ML Model Serving Platform

**Clarify first**
- Model types (classical ML, deep learning, LLMs)? Online (ms latency) vs batch inference? QPS and latency SLOs? GPU needs? Number of models and teams? Need A/B testing, shadow, canary? Feature freshness and consistency requirements?

**Approach before answering**
- A platform with **registry → deploy → serve → monitor** lifecycle. Key issues: **latency/throughput (batching, hardware)**, **safe rollouts**, **feature consistency (training-serving skew)**, and **monitoring for drift**.

**Final answer**
- **Model registry:** versioned artifacts + metadata (training data version, metrics, signature, owner), promotion stages (staging → production); CI validates model (schema, accuracy threshold, latency benchmark) before promotion.
- **Serving layer:** models packaged as containers/standard runtimes (**Triton, TorchServe, TF Serving, vLLM for LLMs, KServe/Seldon on Kubernetes**); a thin **inference gateway** handles auth, routing, rate limits, request validation, and model-version selection.
- **Performance:** **dynamic batching** (accumulate requests for a few ms to fill a GPU batch), model quantisation (INT8/FP8), compilation (TensorRT/ONNX Runtime), warm instances (avoid cold starts), response caching for deterministic inputs; for LLMs: **continuous batching, KV-cache, paged attention, speculative decoding**.
- **Autoscaling:** scale on **queue depth/latency/GPU utilisation** (not CPU); separate pools per model/priority; scale-to-zero for rarely used models; GPU bin-packing and multi-model sharing (MIG).
- **Features:** **feature store** with online (Redis/Dynamo, low-latency) and offline (warehouse) views sharing one definition to prevent **training-serving skew**; point-in-time correct training sets.
- **Rollouts:** **shadow** (mirror traffic, compare outputs), **canary** (1–5% traffic), **A/B** by user hash with experiment framework, **instant rollback** by repointing the version alias; blue/green for infra.
- **Batch inference:** scheduled/streaming jobs (Spark/Ray/Beam) writing predictions to a store for lookups; cheaper for non-interactive use.
- **Monitoring:** system metrics (latency p50/p99, throughput, errors, GPU util), **data drift** (feature distributions vs training, PSI/KS tests), **prediction drift**, **performance metrics when labels arrive**, alerts + automatic retraining triggers; logging of inputs/outputs (sampled, privacy-safe) to build future training data.
- **Governance:** access control, audit trail of who deployed what, model cards, bias/fairness checks for regulated domains.

**Considerations / trade-offs**
- Latency vs throughput: bigger batches raise GPU efficiency but add queueing delay; tune per SLO.
- Cost: GPUs are expensive; right-size, use spot for batch, quantise, distil.
- Multi-tenancy: isolate noisy models; per-team quotas.
- Reproducibility: pin dependencies, store container digests with the model version.

---

# Final checklist before any design interview

- [ ] I asked 4–6 clarifying questions and wrote the requirements down.
- [ ] I did back-of-envelope numbers and used them to justify choices (cache? shard? queue?).
- [ ] I stated the **consistency model** explicitly for each important data type.
- [ ] I identified the **hard part** and went deep there rather than drawing every box.
- [ ] I covered **failure modes**: what breaks, how we detect it, how we recover.
- [ ] I covered **security/privacy** and **observability** in one sentence each.
- [ ] I named trade-offs and an alternative for each major decision.
- [ ] For AI designs: I covered **evaluation, guardrails, cost, and latency**.
