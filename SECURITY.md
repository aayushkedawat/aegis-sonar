# Security Policy

## Supported Versions

We support the latest release of **aegis-sonar**. Older versions may not receive security patches.

| Version  | Supported |
| -------- | --------- |
| latest   | ✅        |
| < latest | ❌        |

## Reporting a Vulnerability

If you discover a security issue, **please DO NOT open a public issue**.

Instead, report it privately to the maintainer:

**Aayush Kedawat**  
📧 Email: aayushkedawat@gmail.com

We will confirm receipt of your report within 48 hours and provide a timeline for a fix.

## Scope

- Vulnerabilities in CLI commands (`aegis run`, `aegis doctor`, etc.)
- Issues with authentication (SonarQube tokens)
- Potential leaks of sensitive info in logs or reports

## Out of Scope

- Misconfigurations in your SonarQube server
- Issues caused by unsupported Node.js versions (<18)
- Vulnerabilities in upstream dependencies not maintained by us

## Disclosure

We follow **coordinated disclosure**:

- You report privately
- We fix the issue and release a patch
- We credit you (if you want) in release notes
