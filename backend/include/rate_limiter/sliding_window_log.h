// Sliding Window Log: keeps a timestamp for every accepted request. On each
// check, timestamps older than `window` seconds are dropped; if fewer than
// `limit` remain the request is accepted. Perfectly accurate (no boundary
// burst) at the cost of O(limit) memory per key.
#ifndef RL_SLIDING_WINDOW_LOG_H
#define RL_SLIDING_WINDOW_LOG_H

#include <deque>
#include <stdexcept>
#include <unordered_map>

#include "base.h"

namespace rl {

class SlidingWindowLog : public RateLimiter {
public:
    SlidingWindowLog(int limit, double window)
        : limit_(limit), window_(window) {
        if (limit <= 0 || window <= 0)
            throw std::invalid_argument("limit and window must be positive");
    }

    const char* name() const override { return "sliding_window_log"; }

protected:
    Decision check(const std::string& key, double now, int cost) override {
        std::deque<double>& log = logs_[key];

        // Evict timestamps that have slid out of the window.
        double boundary = now - window_;
        while (!log.empty() && log.front() <= boundary) log.pop_front();

        Decision d;
        d.limit = limit_;
        if (static_cast<int>(log.size()) + cost <= limit_) {
            for (int i = 0; i < cost; ++i) log.push_back(now);
            d.allowed = true;
        } else if (!log.empty()) {
            // Oldest timestamp leaving the window frees the next slot.
            d.retry_after = log.front() + window_ - now;
            if (d.retry_after < 0) d.retry_after = 0;
        }
        d.used = static_cast<double>(log.size());
        d.remaining = limit_ - static_cast<double>(log.size());
        return d;
    }

private:
    int limit_;
    double window_;
    std::unordered_map<std::string, std::deque<double>> logs_;
};

} // namespace rl

#endif // RL_SLIDING_WINDOW_LOG_H
