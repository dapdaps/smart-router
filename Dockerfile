FROM node:16.17.1-bullseye
WORKDIR /app
COPY . .

ENTRYPOINT ["npm run start"]