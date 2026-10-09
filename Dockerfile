FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production ACADEMY_PRODUCTION=1 ACADEMY_STORAGE=postgres
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY . .
RUN npm test
RUN mkdir -p /app/data/uploads /app/backups
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=5 CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node","server/server.js"]
