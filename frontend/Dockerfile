# --- build stage: install deps and build the Next.js app ---
FROM node:20-alpine AS build
WORKDIR /app
COPY frontend/package.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# --- runtime stage: run the production Next.js server ---
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app ./
# the /api/* proxy target; overridden by docker-compose to the backend service
ENV BACKEND_URL=http://backend:8080
EXPOSE 3000
CMD ["npm", "run", "start"]
