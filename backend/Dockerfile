# Node.js backend whose rate-limiting algorithms are a C++ N-API addon.
# --- build stage: compile the native addon ---
FROM node:20-bookworm AS build
WORKDIR /app/backend
# toolchain node-gyp needs to build the C++ addon
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY backend/package.json backend/binding.gyp ./
COPY backend/native ./native
COPY backend/include ./include
RUN npm install   # gypfile:true → builds native/addon.cpp into build/Release/ratelimiter.node

# --- runtime stage: slim image with just what's needed to run ---
FROM node:20-slim
WORKDIR /app/backend
COPY --from=build /app/backend/node_modules ./node_modules
COPY --from=build /app/backend/build ./build
COPY --from=build /app/backend/include ./include
COPY backend/server.js ./
EXPOSE 8080
CMD ["node", "server.js"]
