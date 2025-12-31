# -------- Builder Stage --------
    FROM node:22.11.0-alpine AS builder

    WORKDIR /app
    
    # Install dependencies (including Prisma + esbuild)
    COPY package*.json ./
    RUN npm ci
    
    # Copy source files
    COPY . .
    
    # Generate Prisma client
    RUN npx prisma generate
    
    # Build app (assuming you're using esbuild or similar)
    RUN npm run build
    
    
    # -------- Production Stage --------
    FROM node:22.11.0-alpine
    
    WORKDIR /app
    
    # Add process manager for safe PID 1 handling
    RUN apk add --no-cache curl dumb-init
    
    # Copy only production dependencies
    COPY package*.json ./
    RUN npm ci --only=production
    
    # Copy Prisma client from builder stage
    COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
    COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
    
    # Copy compiled app
    COPY --from=builder /app/dist ./dist
    
    # Copy entire prisma folder (includes schema.prisma + migrations)
    COPY --from=builder /app/prisma ./prisma
    
    # Optional: expose app port
    EXPOSE 9090
    
    # Set environment
    ENV NODE_ENV=production
    
    # Entrypoint with safe signal handling
    ENTRYPOINT ["dumb-init", "--"]
    
    # Run migration deploy then start app
    CMD ["sh", "-c", "npm run db:deploy && npm start"]
    