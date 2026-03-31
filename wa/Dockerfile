FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY tsconfig.json ./
COPY src ./src
RUN npm run build
ENV WA_SESSION_PATH=/app/session
EXPOSE 3100
CMD ["node", "dist/index.js"]
