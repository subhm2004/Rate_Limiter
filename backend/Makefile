# The HTTP server is now Node.js (server.js) loading the C++ algorithms as a
# native addon. This Makefile only builds and runs the C++ unit tests, which
# exercise the header-only algorithm library directly.
CXX      ?= c++
CXXFLAGS ?= -std=c++17 -O2 -Wall -Wextra -pthread -Iinclude
BUILD    := build-cpp

.PHONY: test clean

$(BUILD)/tests: tests/tests.cpp $(wildcard include/rate_limiter/*.h)
	@mkdir -p $(BUILD)
	$(CXX) $(CXXFLAGS) tests/tests.cpp -o $@

test: $(BUILD)/tests
	./$(BUILD)/tests

clean:
	rm -rf $(BUILD)
