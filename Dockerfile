FROM node:24-alpine
WORKDIR /app
COPY package.json server.js auth.js store.js ./
COPY public ./public
RUN mkdir -p /app/data && chown -R node:node /app
USER node
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["node", "server.js"]
