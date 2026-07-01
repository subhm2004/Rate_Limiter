// Common interface shared by every rate-limiting algorithm.
#ifndef RL_BASE_H
#define RL_BASE_H

#include <chrono>
#include <mutex>
#include <string>

namespace rl {

// Result of one rate-limit check. The extra `used`/`limit` fields let the
// frontend draw a gauge that fills up as a key approaches its limit.
struct Decision {
    bool   allowed     = false;  // request permitted?
    double remaining   = 0;      // units still available right now
    double retry_after = 0;      // seconds until it would be allowed (0 if allowed)
    double limit       = 0;      // configured ceiling
    double used        = 0;      // current load toward the limit (gauge value)
};

// Seconds from a monotonic clock (immune to wall-clock/NTP jumps).
inline double now_seconds() {
    using namespace std::chrono;
    return duration<double>(steady_clock::now().time_since_epoch()).count();
}

// Base class for per-key rate limiters. Each algorithm keeps independent state
// for every `key` (user id, IP, API token, ...) and is safe across threads.
class RateLimiter {
public:
    virtual ~RateLimiter() = default;

    // Stable identifier, e.g. "token_bucket".
    virtual const char* name() const = 0;

    // Try to consume `cost` units for `key`. Thread-safe.
    Decision allow(const std::string& key, int cost = 1) {
        std::lock_guard<std::mutex> lock(mu_);
        return check(key, now_seconds(), cost);
    }

protected:
    // Algorithm-specific logic, called while holding `mu_`.
    virtual Decision check(const std::string& key, double now, int cost) = 0;

    std::mutex mu_;
};

} // namespace rl

#endif // RL_BASE_H
