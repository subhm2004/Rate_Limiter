// Minimal assertion-based tests for the five algorithms (no test framework).
// Build & run:  make test
#include <atomic>
#include <cassert>
#include <cstdio>
#include <thread>
#include <vector>

#include "rate_limiter/fixed_window.h"
#include "rate_limiter/leaking_bucket.h"
#include "rate_limiter/sliding_window_counter.h"
#include "rate_limiter/sliding_window_log.h"
#include "rate_limiter/token_bucket.h"

using namespace rl;

static int passed = 0;
#define CHECK(cond)                                                       \
    do {                                                                  \
        if (!(cond)) {                                                    \
            printf("FAIL %s:%d  %s\n", __FILE__, __LINE__, #cond);        \
            return false;                                                 \
        }                                                                 \
        ++passed;                                                         \
    } while (0)

static void sleep_s(double s) {
    std::this_thread::sleep_for(std::chrono::duration<double>(s));
}

static int allowed_in(RateLimiter& r, const char* key, int n) {
    int ok = 0;
    for (int i = 0; i < n; ++i) ok += r.allow(key).allowed ? 1 : 0;
    return ok;
}

static bool test_token_bucket() {
    TokenBucket tb(5, 10);                 // 5 cap, 0.1s/token
    CHECK(allowed_in(tb, "u", 5) == 5);    // burst up to capacity
    CHECK(!tb.allow("u").allowed);         // empty
    sleep_s(0.15);
    CHECK(tb.allow("u").allowed);          // refilled
    return true;
}

static bool test_leaking_bucket() {
    LeakingBucket lb(3, 10);
    CHECK(allowed_in(lb, "u", 3) == 3);
    CHECK(!lb.allow("u").allowed);
    sleep_s(0.15);
    CHECK(lb.allow("u").allowed);          // drained
    return true;
}

static bool test_fixed_window() {
    FixedWindowCounter fw(3, 0.3);
    CHECK(allowed_in(fw, "u", 3) == 3);
    CHECK(!fw.allow("u").allowed);
    sleep_s(0.35);
    CHECK(fw.allow("u").allowed);          // new window
    return true;
}

static bool test_sliding_log() {
    SlidingWindowLog sl(2, 0.4);
    CHECK(sl.allow("u").allowed && sl.allow("u").allowed);
    sleep_s(0.2);
    CHECK(!sl.allow("u").allowed);         // accurate: no boundary burst
    sleep_s(0.3);
    CHECK(sl.allow("u").allowed);          // oldest slid out
    return true;
}

static bool test_sliding_counter() {
    SlidingWindowCounter sc(2, 0.3);
    CHECK(sc.allow("u").allowed && sc.allow("u").allowed);
    CHECK(!sc.allow("u").allowed);
    sleep_s(0.65);                         // two windows pass -> reset
    CHECK(sc.allow("u").allowed);
    return true;
}

static bool test_keys_independent() {
    TokenBucket tb(2, 1);
    CHECK(allowed_in(tb, "a", 2) == 2);
    CHECK(!tb.allow("a").allowed);
    CHECK(tb.allow("b").allowed);          // separate key unaffected
    return true;
}

static bool test_thread_safety() {
    TokenBucket tb(100, 1);
    std::atomic<int> allowed{0};
    std::vector<std::thread> ts;
    for (int i = 0; i < 200; ++i)
        ts.emplace_back([&] { if (tb.allow("shared").allowed) allowed++; });
    for (auto& t : ts) t.join();
    CHECK(allowed.load() <= 100);          // never exceeds capacity
    return true;
}

int main() {
    struct { const char* name; bool (*fn)(); } cases[] = {
        {"token_bucket", test_token_bucket},
        {"leaking_bucket", test_leaking_bucket},
        {"fixed_window", test_fixed_window},
        {"sliding_log", test_sliding_log},
        {"sliding_counter", test_sliding_counter},
        {"keys_independent", test_keys_independent},
        {"thread_safety", test_thread_safety},
    };
    int failed = 0;
    for (auto& c : cases) {
        bool ok = c.fn();
        printf("%-18s %s\n", c.name, ok ? "ok" : "FAILED");
        failed += ok ? 0 : 1;
    }
    printf("\n%d checks passed, %d test(s) failed\n", passed, failed);
    return failed ? 1 : 0;
}
