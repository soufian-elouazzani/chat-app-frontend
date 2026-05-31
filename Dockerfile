# syntax=docker/dockerfile:1
FROM node:20-alpine AS builder

WORKDIR /app
ENV PATH /app/node_modules/.bin:$PATH

# Install dependencies based on package lock if available
COPY package*.json ./
RUN npm ci --silent

# Copy source and build
COPY . .
RUN npm run build

FROM nginx:stable-alpine

# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Use custom nginx config to support SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
