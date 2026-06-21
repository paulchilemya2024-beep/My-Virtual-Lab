# Scaling notes — how this backend handles millions of users

A common misconception is that "using linked lists and hash maps" is what makes
a web service scale. In practice, the data structures matter only in specific
hot paths — the **big** scaling wins come from architecture. Here is what this
backend actually does, in order of impact.

## 1. Stateless authentication (biggest win)
Login state lives in a signed **JWT**, not in server memory. That means **any**
server instance can handle **any** request, so you scale by running more copies
behind a load balancer — 1 server or 100, no shared session store needed. This
is the single most important property for horizontal scaling.

## 2. Database indexes — O(log n) instead of O(n)
- `User.email` — unique index (login lookups).
- `Progress.userId` — unique index (one summary doc per user).
- `Session.userId` — index, plus a **compound index `{ userId, createdAt }`** for
  the "this user's sessions, newest first" query the dashboard runs constantly.

Without indexes, every query scans the whole collection (O(n)) — fatal at tens
of millions of rows. With them, MongoDB does an index seek (O(log n)).

## 3. LRU cache — hash map + doubly linked list, O(1)
Experiments are read on almost every page load but change rarely. The
[`LRUCache`](src/utils/LRUCache.js) caches them in memory:
- a **hash map** for O(1) key → node lookup, and
- a **doubly linked list** ordered by recency, so promoting a hit to "most
  recent" and evicting the least-recent are both O(1) (no array shifting).

Result: the vast majority of experiment reads never touch MongoDB, and cache
latency stays flat regardless of cache size. (At true multi-server scale this
becomes a shared **Redis** cache so all instances share one cache.)

## 4. Pagination — bounded responses
Session history is paged (`?page=&limit=`, capped at 50). We never return an
unbounded list, so one heavy user can't blow up memory or response time.

## 5. `.lean()` reads
Read-only queries use Mongoose `.lean()`, returning plain JS objects instead of
full Mongoose documents — much less CPU and memory per request.

## What you'd add next for true 2M-user scale
- **Redis** for the cache + rate limiting (shared across instances).
- **Connection pooling** tuning on the Mongo driver (already pooled by default).
- **Read replicas** for MongoDB so reads spread across nodes.
- A **CDN** in front of the static frontend (Vercel already does this).
- **Rate limiting** on `/api/agent/ask` to stay within the Gemini free tier.
- **Queue** (e.g. BullMQ) for any slow work so requests return fast.

The code here is structured so each of these slots in without a rewrite.
