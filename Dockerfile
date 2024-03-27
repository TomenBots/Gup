# Use an official Node runtime as a base image
FROM node:14-alpine

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the React app
RUN npm run build

# Expose port 80 to the outside world
EXPOSE 80

# Command to run the application
CMD ["npm", "run", "start", "--", "-p", "80"]
