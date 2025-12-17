# Build Stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Runner Stage
FROM nginx:alpine

# Install gettext for envsubst
RUN apk add --no-cache gettext

# Copy static assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx template
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 80

# Nginx 1.19+ automatically runs envsubst on templates in /etc/nginx/templates
# if we use the default entrypoint. 
# We just need to ensure API_URL is set.
CMD ["nginx", "-g", "daemon off;"]
