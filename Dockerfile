FROM node:22-slim

# Install make and gh CLI since the agent needs to execute make targets and use gh
RUN apt-get update && apt-get install -y make curl && \
    curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg && \
    chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null && \
    apt-get update && apt-get install -y gh && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@10.25.0 --activate

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy app source and Makefile
COPY app/ ./app/
COPY tsconfig.json Makefile ./

# Build the app
RUN pnpm build

# Set environment variables
ENV NODE_ENV=production

# Start the bot
CMD ["node", "dist/index.js"]
