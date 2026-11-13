# Security

The production host is GitHub Pages. Its managed HTTPS response supplies HSTS; this repository cannot set custom HTTP response headers. HTML therefore supplies a Content Security Policy and referrer policy. CSP blocks objects, limits scripts to this origin, and restricts base URLs and form actions. Fonts use Google Fonts; HTTPS images remain allowed for the existing design. Frame-ancestors, X-Frame-Options, Permissions-Policy and X-Content-Type-Options require host support and are not claimed here. No ineffective _headers file is shipped.

CI audits npm dependencies, scans Git history excluding environment files with fully redacted output, and fails external links only on confirmed 404/410 responses. Network failures, throttling and access restrictions are reported as unverified.

The 37 exact historical scanner fingerprints cover signed GitHub image URLs and public URL hashes in old routed feed/digest content. They do not allow future files or commits. Values are never printed.

Report vulnerabilities privately through [GitHub private vulnerability reporting](https://github.com/koltregaskes/stackscout/security/advisories/new).
