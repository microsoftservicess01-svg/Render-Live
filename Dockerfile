FROM node:18-alpine
WORKDIR /app

COPY backend/package.json backend/package-lock.json* ./backend/
RUN cd backend && npm install --production

COPY backend ./backend
COPY frontend ./frontend

WORKDIR /app/backend
ENV PORT=3000
EXPOSE 3000
CMD ["node", "server.js"]
