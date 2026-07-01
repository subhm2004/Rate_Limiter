// Fixed Window Counter: time is split into fixed windows of `window` seconds,
// each allowing up to `limit` requests. Cheapest to run, but allows up to 2x
// the limit across a window boundary (the burst the sliding variants fix).
#ifndef RL_FIXED_WINDOW_H
#define RL_FIXED_WINDOW_H

#include <cmath>
#include <stdexcept>
#include <unordered_map>

#include "base.h"

namespace rl {

class FixedWindowCounter : public RateLimiter {
public:
    FixedWindowCounter(int limit, double window)
        : limit_(limit), window_(window) {
        if (limit <= 0 || window <= 0)
            throw std::invalid_argument("limit and window must be positive");
    }

    const char* name() const override { return "fixed_window"; }

protected:
    Decision check(const std::string& key, double now, int cost) override {
        Window& w = windows_[key];
        if (!w.init || now - w.start >= window_) {
            // Snap the window start to a deterministic grid boundary.
            w.start = std::floor(now / window_) * window_;
            w.count = 0;
            w.init = true;
        }

        double window_end = w.start + window_;
        Decision d;
        d.limit = limit_;
        if (w.count + cost <= limit_) {
            w.count += cost;
            d.allowed = true;
        } else {
            d.retry_after = window_end - now;
        }
        d.used = w.count;
        d.remaining = limit_ - w.count;
        return d;
    }

private:
    struct Window { double start = 0; int count = 0; bool init = false; };
    int limit_;
    double window_;
    std::unordered_map<std::string, Window> windows_;
};

} // namespace rl

#endif // RL_FIXED_WINDOW_H
