FROM docker.io/library/node:14-alpine@sha256:434215b487a329c9e867202ff89e704d3a75e554822e07f3e0c0f9e606121b33

WORKDIR /app

COPY package*.json ./

RUN npm install react-scripts -g

RUN npm install && npm run build

COPY frontend ./frontend   # Copy frontend directory into the Docker build context

COPY . .

CMD ["npm", "start", "--", "-p", "80"]
