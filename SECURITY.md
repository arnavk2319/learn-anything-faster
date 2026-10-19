# Security policy

Report vulnerabilities privately through GitHub's "Report a vulnerability" (Security tab) rather than a
public issue. Do not include real user emails or secrets in reports.

Automated checks on this repo: gitleaks (secrets), Semgrep (static analysis), `pnpm audit` and Dependabot
(dependencies), plus the security and tool-safety test suites (`pnpm test:security`, `pnpm test:tools`).
