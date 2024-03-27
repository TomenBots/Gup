FROM docker.io/library/node:14-alpine@sha256:434215b487a329c9e867202ff89e704d3a75e554822e07f3e0c0f9e606121b33

WORKDIR /app

COPY package*.json ./

RUN npm install react-scripts -g

RUN npm install

COPY . .

RUN npm run build
