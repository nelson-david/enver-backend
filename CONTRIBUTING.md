# Contributing to Enver Server

Thank you for your interest in contributing to the Enver server backend! This document outlines the process for contributing to this project.

## Getting Started

1. **Fork the repository**: Go to GitHub and click the "Fork" button
2. **Clone your fork**: `git clone https://github.com/your-username/enver-server.git`
3. **Create your feature branch**: `git checkout -b feature/your-feature-name`
4. **Make your changes** following the guidelines below
5. **Commit your changes**: `git commit -am 'Add some feature'`
6. **Push to the branch**: `git push origin feature/your-feature-name`
7. **Submit a Pull Request** to the `main` branch

## Code Standards

### TypeScript/JavaScript
- Follow [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript)
- Use TypeScript for all new code
- Prefer functional components with hooks over class components
- Use async/await over promises where possible

### Security-First Mindset
- **Never commit secrets** (API keys, passwords, tokens)
- All environment variables must come from environment variables, never hardcoded
- All API inputs must be validated using Zod schemas
- Follow the principle of least privilege
- Consider security implications of every change

### Database
- Use parameterized queries to prevent SQL injection (though using Mongoose)
- Validate ObjectId formats before queries
- Ensure connection limits are respected (maxPoolSize, minPoolSize)

### Authentication
- All token-based authentication must validate scopes
- IP binding should be enforced where applicable
- Audit logs must not contain sensitive data

### Testing
- Write tests for new endpoints
- Test rate limiting behavior
- Test token scope enforcement
- Test IP binding validation
- Run existing tests before submitting: `npm test`

## Pull Request Process

1. **Describe your changes** clearly in the PR description
2. **Link related issues** (e.g., "Fixes #123")
3. **Update documentation** if needed
4. **Keep PRs focused** - one feature/fix per PR
5. **Wait for review** - address feedback promptly

### Code Review Checklist
- [ ] Security implications reviewed
- [ ] Input validation present
- [ ] No secrets in code
- [ ] Tests added for new functionality
- [ ] Documentation updated

## Security Issues

**Do NOT create public issues for security vulnerabilities.**

Instead, contact the main developer directly via email with the subject "SECURITY ISSUE - Enver Server". Provide:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We'll respond within 48 hours and coordinate a fix.

## License

By contributing to this project, you agree that your contributions will be licensed under the MIT License.

## Thank You

Thank you for helping make Enver server better! 🔒