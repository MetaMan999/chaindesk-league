FROM node:20-alpine
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/realtime/package.json apps/realtime/package.json
RUN pnpm install --prod --frozen-lockfile --filter @banker-bros/realtime...
COPY apps/realtime apps/realtime
ENV NODE_ENV=production REALTIME_HOST=0.0.0.0 REALTIME_PORT=8787
ENV REALTIME_DATA_FILE=/data/realtime-profiles.json
RUN mkdir -p /data && chown node:node /data
VOLUME ["/data"]
EXPOSE 8787
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD ["node", "-e", "fetch('http://127.0.0.1:8787/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
CMD ["node", "apps/realtime/src/server.mjs"]
