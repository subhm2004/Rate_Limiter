// Token Bucket: a bucket holds up to `capacity` tokens and refills at
// `refill_rate` tokens/sec. Each request removes `cost` tokens. Allows short
// bursts up to capacity while bounding the long-run average rate.
#ifndef RL_TOKEN_BUCKET_H
#define RL_TOKEN_BUCKET_H

#include <algorithm>
#include <stdexcept>
#include <unordered_map>

#include "base.h"

namespace rl {

class TokenBucket : public RateLimiter {
public:
    TokenBucket(double capacity, double refill_rate)
        : capacity_(capacity), refill_rate_(refill_rate) {
        if (capacity <= 0 || refill_rate <= 0)
            throw std::invalid_argument("capacity and refill_rate must be positive");
    }

    const char* name() const override { return "token_bucket"; }

protected:
    Decision check(const std::string& key, double now, int cost) override {
        Bucket& b = buckets_[key];
        if (!b.init) { b.tokens = capacity_; b.last = now; b.init = true; }

        // Refill based on elapsed time, capped at capacity.
        double elapsed = now - b.last;
        b.tokens = std::min(capacity_, b.tokens + elapsed * refill_rate_);
        b.last = now;

        Decision d;
        d.limit = capacity_;
        if (b.tokens >= cost) {
            b.tokens -= cost;
            d.allowed = true;
        } else {
            d.retry_after = (cost - b.tokens) / refill_rate_;
        }
        d.remaining = b.tokens;
        d.used = capacity_ - b.tokens;
        return d;
    }

private:
    struct Bucket { double tokens = 0, last = 0; bool init = false; };
    double capacity_, refill_rate_;
    std::unordered_map<std::string, Bucket> buckets_;
};

} // namespace rl

#endif // RL_TOKEN_BUCKET_H
