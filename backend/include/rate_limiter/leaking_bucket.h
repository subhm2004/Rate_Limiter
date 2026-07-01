// Leaking Bucket: requests fill a queue that "leaks" at a constant
// `leak_rate` units/sec. The queue holds at most `capacity` units; anything
// that would overflow is rejected. Smooths bursty input into a steady outflow.
#ifndef RL_LEAKING_BUCKET_H
#define RL_LEAKING_BUCKET_H

#include <algorithm>
#include <stdexcept>
#include <unordered_map>

#include "base.h"

namespace rl {

class LeakingBucket : public RateLimiter {
public:
    LeakingBucket(double capacity, double leak_rate)
        : capacity_(capacity), leak_rate_(leak_rate) {
        if (capacity <= 0 || leak_rate <= 0)
            throw std::invalid_argument("capacity and leak_rate must be positive");
    }

    const char* name() const override { return "leaking_bucket"; }

protected:
    Decision check(const std::string& key, double now, int cost) override {
        Bucket& b = buckets_[key];
        if (!b.init) { b.level = 0; b.last = now; b.init = true; }

        // Drain by the amount leaked since we last looked.
        double elapsed = now - b.last;
        b.level = std::max(0.0, b.level - elapsed * leak_rate_);
        b.last = now;

        Decision d;
        d.limit = capacity_;
        if (b.level + cost <= capacity_) {
            b.level += cost;
            d.allowed = true;
        } else {
            double overflow = b.level + cost - capacity_;
            d.retry_after = overflow / leak_rate_;
        }
        d.used = b.level;
        d.remaining = capacity_ - b.level;
        return d;
    }

private:
    struct Bucket { double level = 0, last = 0; bool init = false; };
    double capacity_, leak_rate_;
    std::unordered_map<std::string, Bucket> buckets_;
};

} // namespace rl

#endif // RL_LEAKING_BUCKET_H
