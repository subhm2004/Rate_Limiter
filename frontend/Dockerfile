# --- build stage: install deps and build the Next.js app ---
FROM node:20-alpine AS build
WORKDIR /app
COPY frontend/package.json ./
RUN npm install
COPY frontend/ ./
# IMPORTANT: Next.js bakes rewrites at BUILD time, so BACKEND_URL must be
# decided here, not at runtime. Priority:
#   build arg (docker-compose / --build-arg)  >  committed frontend/.env
# When the arg is absent we unset the (empty) variable so that .env applies.
ARG BACKEND_URL
RUN if [ -n "$BACKEND_URL" ]; then npm run build; \
    else unset BACKEND_URL && npm run build; fi

# --- runtime stage: run the production Next.js server ---
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app ./
EXPOSE 3000
CMD ["npm", "run", "start"]
