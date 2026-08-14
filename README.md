# Enver Server

Backend API server for Enver secrets management platform.

## Overview
This repository contains the backend server implementation for Enver, built with Hono.js and Node.js. It provides:

- RESTful API endpoints for secrets management
- Authentication with token-based permissions
- Zero-knowledge encryption using Shamir's Secret Sharing
- Activity logging for audit trails
- IP-binding for security
- Rate limiting protections
- Comprehensive audit logging

## Architecture
The server follows a modular architecture:

```
src/
├── middleware/          # Global middleware
│   ├── auth.ts         # Authentication & token validation
│   ├── errorHandler.ts # Global error handling
│   ├── performance.ts  # Performance monitoring
│   └── rateLimiter.ts  # Rate limiting middleware
├── database/            # Database connection & schema
│   └── index.ts        # MongoDB connection
├── modules/             # Feature modules
│   ├── envs/           # Environment & secret endpoints
│   ├── members/        # User membership management
│   ├── tokens/         # API token management
│   ├── projects/       # Project management
│   └── activity/       # Activity logging
└── config.ts           # Application configuration
```

## Key Features

### 🔐 Security Features
- **Token-based authentication** with IP binding (prevents token theft)
- **Scope enforcement** (`read:secrets`, `write:secrets`, `admin`)
- **Rate limiting** (100 requests/minute per IP/user)
- **Zer0-knowledge architecture** principles
- **Audit logging** for all operations

### 🛡️ Middleware Stack
1. `auth.ts` - Validates tokens and binds them to IPs
2. `rateLimiter.ts` - Limits requests to 100/minute/IP
3. `auth.ts` - Checks token scopes before route execution
4. Custom security headers and error handling

### 📦 Build & Test
- **Build**: `npm run build` (tsc compilation)
- **Test**: `npm test` (Jest/Swagger-based tests)
- **Lint**: `npm run lint` (ESLint configuration)

### 🚀 Deployment
The server is deployed via GitHub Actions workflows configured in `.github/workflows/deploy.yml`. Deployment hooks trigger on pushes to:
- `develop` → Staging environment
- `main` → Production environment

## Getting Started

### Prerequisites
- Node.js 20+
- MongoDB instance (local or Atlas)
- SSH access or deployment platform (Render/Railway/Netlify)

### Setup
```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration values

# Development
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Testing & CI
This repository is integrated with GitHub Actions for:
- Automatic testing on every PR/push
- Linting and type checking
- Automated builds
- Deployment to staging/production via webhooks

For detailed CI/CD configuration, see `.github/workflows/deploy.yml`.