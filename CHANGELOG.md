# Server Changelog

All notable changes to the Enver server will be documented in this file.

## [1.0.0] - 2026-08-12

### Added
- Initial server release with Hono framework
- MongoDB connection with pooling (maxPoolSize: 10, minPoolSize: 2)
- Rate limiting middleware (100 requests/minute per IP)
- Token scope enforcement middleware
- IP address binding for API tokens
- Environment variable management endpoints
- Project and member management endpoints
- Activity logging for audit trails

### Security Features
- Token-based authentication with JWT alternative (SHA-256 hashes)
- Token scope validation (read:secrets, write:secrets, admin)
- IP address binding for tokens
- Rate limiting to prevent brute force attacks
- MongoDB connection pooling to prevent exhaustion
- Comprehensive error handling to prevent information leakage

### API Endpoints
- POST /api/v1/envs - Store encrypted environments
- GET /api/v1/envs - List environments
- GET /api/v1/envs/share/:projectId - Fetch shared secret payload
- DELETE /api/v1/envs/:projectId - Delete environment and cascade to project if empty
- POST /api/v1/projects - Create new project workspace
- POST /api/v1/projects/:projectId/members - Add member to project
- DELETE /api/v1/projects/:projectId/members/:email - Remove member from project
- POST /api/v1/tokens - Create new API token with IP binding
- GET /api/v1/tokens - List user tokens
- DELETE /api/v1/tokens/:id - Revoke API token
- GET /api/v1/activity/:projectId - Fetch activity logs

[Unreleased]: https://github.com/enver/server/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/enver/server/releases/tag/v1.0.0