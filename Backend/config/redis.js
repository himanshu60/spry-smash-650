const redis = require("redis");

/**
 * Token store used by auth (login / logout).
 *
 * The original deployment pointed at a hardcoded RedisLabs instance that is now
 * dead. To keep the app runnable locally AND deployable without provisioning a
 * Redis server, this module:
 *   1. Uses a real Redis client when `REDIS_URL` is provided and reachable.
 *   2. Falls back to an in-memory store implementing the same command subset
 *      the app relies on (GET / SET / HGET / HSET).
 *
 * The exported `redisclient` is a stable proxy, so callers always reach the
 * currently active backend even after an async connection upgrade.
 */

// ---- In-memory fallback (implements only what this app uses) ----
const store = new Map();
const hashes = new Map();

const memoryClient = {
  async connect() {},
  async GET(key) {
    return store.has(key) ? store.get(key) : null;
  },
  async SET(key, value) {
    store.set(key, value);
    return "OK";
  },
  async HGET(hash, field) {
    const m = hashes.get(hash);
    return m && m.has(field) ? m.get(field) : null;
  },
  async HSET(hash, field, value) {
    let m = hashes.get(hash);
    if (!m) {
      m = new Map();
      hashes.set(hash, m);
    }
    m.set(field, value);
    return 1;
  },
};

let active = memoryClient;

if (process.env.REDIS_URL) {
  const real = redis.createClient({
    url: process.env.REDIS_URL,
    socket: { connectTimeout: 8000 },
  });
  real.on("error", (e) => console.log("Redis error:", e.message));
  real
    .connect()
    .then(() => {
      active = real;
      console.log("connected to redis");
    })
    .catch((e) =>
      console.log("Redis unavailable, using in-memory token store:", e.message)
    );
} else {
  console.log(
    "No REDIS_URL set — using in-memory token store (fine for local/dev)."
  );
}

// Stable proxy: always delegates to the currently active client.
const redisclient = {
  connect: (...args) => active.connect(...args),
  GET: (...args) => active.GET(...args),
  SET: (...args) => active.SET(...args),
  HGET: (...args) => active.HGET(...args),
  HSET: (...args) => active.HSET(...args),
};

module.exports = { redisclient };
