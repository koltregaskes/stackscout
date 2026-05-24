# Security Policy

## Reporting

If you discover a security issue in `stackscout`, please report it privately first.

Until a dedicated security inbox is published, do not open a public issue containing:

- secrets
- private workspace paths
- internal operational notes
- unpublished catalog research or manager-only data

## Scope

The most important security rule in this project is data separation:

- public catalog output must only come from allowlisted public-safe fields
- internal runtime data must not leak into committed public assets
- third-party tool / API data referenced in the catalog must respect the source's terms
