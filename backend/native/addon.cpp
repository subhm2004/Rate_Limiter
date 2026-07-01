// N-API native addon: exposes the C++ rate-limiting algorithms to Node.js.
// The actual algorithm logic lives in the header-only library under include/;
// this file only bridges it to JavaScript. A single thread-safe registry
// (Manager) owns one limiter per algorithm.
#include <napi.h>

#include <map>
#include <memory>
#include <mutex>
#include <stdexcept>
#include <string>
#include <vector>

#include "rate_limiter/fixed_window.h"
#include "rate_limiter/leaking_bucket.h"
#include "rate_limiter/sliding_window_counter.h"
#include "rate_limiter/sliding_window_log.h"
#include "rate_limiter/token_bucket.h"

using namespace rl;

struct AlgoInfo {
    std::string id, title, desc, p1_label, p2_label;
    double p1, p2;
};

// Thread-safe registry of one limiter per algorithm.
class Manager {
public:
    Manager() {
        infos_ = {
            {"token_bucket", "Token Bucket",
             "Refills tokens steadily; allows bursts up to capacity.", "Capacity", "Refill /s", 10, 2},
            {"leaking_bucket", "Leaking Bucket",
             "Queue that leaks at a fixed rate; smooths traffic to a steady outflow.", "Capacity", "Leak /s", 10, 2},
            {"fixed_window", "Fixed Window Counter",
             "N requests per fixed window; cheap, but edge bursts.", "Limit", "Window (s)", 10, 5},
            {"sliding_window_log", "Sliding Window Log",
             "Exact rolling count via a timestamp log.", "Limit", "Window (s)", 10, 5},
            {"sliding_window_counter", "Sliding Window Counter",
             "Weighted two-window approximation of the log.", "Limit", "Window (s)", 10, 5},
        };
        for (auto& i : infos_) build(i.id);
    }

    Decision check(const std::string& algo, const std::string& key, int cost) {
        std::lock_guard<std::mutex> lk(mu_);
        auto it = limiters_.find(algo);
        if (it == limiters_.end()) throw std::runtime_error("unknown algorithm: " + algo);
        return it->second->allow(key, cost);
    }

    void config(const std::string& algo, double p1, double p2) {
        std::lock_guard<std::mutex> lk(mu_);
        AlgoInfo* info = find(algo);
        if (!info) throw std::runtime_error("unknown algorithm: " + algo);
        info->p1 = p1;
        info->p2 = p2;
        build(algo);
    }

    void reset() {
        std::lock_guard<std::mutex> lk(mu_);
        for (auto& i : infos_) build(i.id);
    }

    std::vector<AlgoInfo> infosCopy() {
        std::lock_guard<std::mutex> lk(mu_);
        return infos_;
    }

private:
    AlgoInfo* find(const std::string& id) {
        for (auto& i : infos_) if (i.id == id) return &i;
        return nullptr;
    }

    void build(const std::string& id) {
        AlgoInfo* a = find(id);
        if (!a) return;
        std::unique_ptr<RateLimiter> lim;
        if (id == "token_bucket")            lim = std::make_unique<TokenBucket>(a->p1, a->p2);
        else if (id == "leaking_bucket")     lim = std::make_unique<LeakingBucket>(a->p1, a->p2);
        else if (id == "fixed_window")       lim = std::make_unique<FixedWindowCounter>((int)a->p1, a->p2);
        else if (id == "sliding_window_log") lim = std::make_unique<SlidingWindowLog>((int)a->p1, a->p2);
        else if (id == "sliding_window_counter") lim = std::make_unique<SlidingWindowCounter>((int)a->p1, a->p2);
        if (lim) limiters_[id] = std::move(lim);
    }

    std::mutex mu_;
    std::vector<AlgoInfo> infos_;
    std::map<std::string, std::unique_ptr<RateLimiter>> limiters_;
};

static Manager& mgr() {
    static Manager m;
    return m;
}

// ---- JS-facing functions ----
static Napi::Value Meta(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    auto infos = mgr().infosCopy();
    Napi::Array arr = Napi::Array::New(env, infos.size());
    for (size_t i = 0; i < infos.size(); ++i) {
        const AlgoInfo& a = infos[i];
        Napi::Object o = Napi::Object::New(env);
        o.Set("id", a.id);
        o.Set("title", a.title);
        o.Set("desc", a.desc);
        o.Set("p1_label", a.p1_label);
        o.Set("p2_label", a.p2_label);
        o.Set("p1", a.p1);
        o.Set("p2", a.p2);
        arr.Set((uint32_t)i, o);
    }
    return arr;
}

static Napi::Value Check(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    std::string algo = info[0].As<Napi::String>();
    std::string key = info[1].As<Napi::String>();
    int cost = (info.Length() > 2 && info[2].IsNumber()) ? info[2].As<Napi::Number>().Int32Value() : 1;
    if (cost < 1) cost = 1;
    Decision d;
    try {
        d = mgr().check(algo, key, cost);
    } catch (const std::exception& e) {
        throw Napi::Error::New(env, e.what());
    }
    Napi::Object o = Napi::Object::New(env);
    o.Set("algo", algo);
    o.Set("allowed", d.allowed);
    o.Set("remaining", d.remaining);
    o.Set("retry_after", d.retry_after);
    o.Set("limit", d.limit);
    o.Set("used", d.used);
    return o;
}

static Napi::Value Config(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    std::string algo = info[0].As<Napi::String>();
    double p1 = info[1].As<Napi::Number>().DoubleValue();
    double p2 = info[2].As<Napi::Number>().DoubleValue();
    try {
        mgr().config(algo, p1, p2);
    } catch (const std::exception& e) {
        throw Napi::Error::New(env, e.what());
    }
    return Napi::Boolean::New(env, true);
}

static Napi::Value Reset(const Napi::CallbackInfo& info) {
    mgr().reset();
    return Napi::Boolean::New(info.Env(), true);
}

static Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("meta", Napi::Function::New(env, Meta));
    exports.Set("check", Napi::Function::New(env, Check));
    exports.Set("config", Napi::Function::New(env, Config));
    exports.Set("reset", Napi::Function::New(env, Reset));
    return exports;
}

NODE_API_MODULE(ratelimiter, Init)
