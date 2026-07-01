// Sliding Window Counter: a memory-efficient approximation of the sliding
// window log. Keeps only two counters (current + previous fixed window) and
// estimates the rolling count by weighting the previous window by how much of
// it still overlaps the sliding window:
//
//     estimated = current + previous * overlap_fraction
//
// Smooths the fixed-window boundary burst using O(1) memory per key.
#ifndef RL_SLIDING_WINDOW_COUNTER_H
#define RL_SLIDING_WINDOW_COUNTER_H

#include <algorithm>
#include <cmath>
#include <stdexcept>
#include <unordered_map>

#include "base.h"

namespace rl {

class SlidingWindowCounter : public RateLimiter {
public:
    SlidingWindowCounter(int limit, double window)
        : limit_(limit), window_(window) {
        if (limit <= 0 || window <= 0)
            throw std::invalid_argument("limit and window must be positive");
    }

    const char* name() const override { return "sliding_window_counter"; }

protected:
    Decision check(const std::string& key, double now, int cost) override {
        State& s = state_[key];
        double current_start = std::floor(now / window_) * window_;
        if (!s.init) {
            s.window_start = current_start;
            s.init = true;
        }
        roll(s, current_start);

        // Fraction of the previous window still inside the sliding window.
        double elapsed = now - s.window_start;
        double prev_weight = std::max(0.0, 1.0 - elapsed / window_);
        double estimated = s.previous * prev_weight + s.current;

        Decision d;
        d.limit = limit_;
        if (estimated + cost <= limit_) {
            s.current += cost;
            d.allowed = true;
            d.used = estimated + cost;
        } else {
            d.retry_after = s.previous > 0 ? (window_ - elapsed) : window_;
            d.used = estimated;
        }
        d.remaining = std::max(0.0, limit_ - d.used);
        return d;
    }

private:
    struct State { double window_start = 0; int current = 0, previous = 0; bool init = false; };

    // Advance the window grid to the slot containing `now`.
    void roll(State& s, double current_start) {
        if (current_start == s.window_start) return;
        if (current_start - s.window_start == window_)
            s.previous = s.current;   // moved exactly one window forward
        else
            s.previous = 0;           // skipped one or more empty windows
        s.current = 0;
        s.window_start = current_start;
    }

    int limit_;
    double window_;
    std::unordered_map<std::string, State> state_;
};

} // namespace rl

#endif // RL_SLIDING_WINDOW_COUNTER_H
