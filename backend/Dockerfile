FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY src ./src
COPY uploads ./uploads
COPY storage ./storage

EXPOSE 3333

CMD ["npm", "start"]
