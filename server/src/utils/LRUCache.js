// LRUCache — a Least-Recently-Used cache with O(1) get and set.
//
// WHY THIS EXISTS (scaling to millions of users):
// Experiment definitions are read on almost every page load but change very
// rarely. Hitting MongoDB for the same documents millions of times is wasteful.
// This cache keeps the hottest items in memory so most reads never touch the DB.
//
// HOW IT HITS O(1) — the classic interview structure, used for real here:
//   • A HASH MAP (JS Map) gives O(1) lookup of any key -> its list node.
//   • A DOUBLY LINKED LIST keeps items ordered by recency. The head is the most
//     recently used; the tail is the least recently used.
// On every get/set we splice the touched node to the head in O(1) (no array
// shifting). When we exceed capacity we evict the tail in O(1). Neither
// operation depends on how many items are cached, so latency stays flat whether
// there are 3 users or 2,000,000.
//
// An optional TTL lets cached entries expire so edits to the DB eventually show
// up without a server restart.

class Node {
  constructor(key, value, expiresAt) {
    this.key = key;
    this.value = value;
    this.expiresAt = expiresAt; // ms timestamp, or null for "never expires"
    this.prev = null;
    this.next = null;
  }
}

class LRUCache {
  /**
   * @param {object} opts
   * @param {number} opts.capacity  Max items held before eviction (default 500).
   * @param {number} opts.ttlMs     Time-to-live per entry in ms (0 = no expiry).
   */
  constructor({ capacity = 500, ttlMs = 0 } = {}) {
    this.capacity = capacity;
    this.ttlMs = ttlMs;
    this.map = new Map(); // key -> Node   (the HASH MAP)

    // Sentinel head/tail nodes remove all the null-checking edge cases when
    // inserting/removing from the DOUBLY LINKED LIST.
    this.head = new Node('__head__', null, null);
    this.tail = new Node('__tail__', null, null);
    this.head.next = this.tail;
    this.tail.prev = this.head;

    this.hits = 0;
    this.misses = 0;
  }

  // --- doubly linked list helpers (all O(1)) ---
  _remove(node) {
    node.prev.next = node.next;
    node.next.prev = node.prev;
  }

  _addToFront(node) {
    node.prev = this.head;
    node.next = this.head.next;
    this.head.next.prev = node;
    this.head.next = node;
  }

  _moveToFront(node) {
    this._remove(node);
    this._addToFront(node);
  }

  get(key) {
    const node = this.map.get(key); // O(1) hash-map lookup
    if (!node) {
      this.misses += 1;
      return undefined;
    }

    // Expired? Drop it and report a miss.
    if (node.expiresAt && node.expiresAt <= now()) {
      this._remove(node);
      this.map.delete(key);
      this.misses += 1;
      return undefined;
    }

    this._moveToFront(node); // mark as most-recently-used, O(1)
    this.hits += 1;
    return node.value;
  }

  set(key, value) {
    const existing = this.map.get(key);
    const expiresAt = this.ttlMs ? now() + this.ttlMs : null;

    if (existing) {
      existing.value = value;
      existing.expiresAt = expiresAt;
      this._moveToFront(existing);
      return;
    }

    const node = new Node(key, value, expiresAt);
    this._addToFront(node);
    this.map.set(key, node);

    // Evict the least-recently-used item (the real tail) if over capacity.
    if (this.map.size > this.capacity) {
      const lru = this.tail.prev;
      this._remove(lru);
      this.map.delete(lru.key);
    }
  }

  delete(key) {
    const node = this.map.get(key);
    if (!node) return false;
    this._remove(node);
    this.map.delete(key);
    return true;
  }

  clear() {
    this.map.clear();
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  get size() {
    return this.map.size;
  }

  stats() {
    const total = this.hits + this.misses;
    return {
      size: this.map.size,
      capacity: this.capacity,
      hits: this.hits,
      misses: this.misses,
      hitRate: total ? +(this.hits / total).toFixed(3) : 0,
    };
  }
}

// new Date() / Date.now() are wrapped so this file has one obvious time source.
function now() {
  return Date.now();
}

module.exports = LRUCache;
