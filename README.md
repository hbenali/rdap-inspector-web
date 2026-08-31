# RDAP Inspector

A free, single-page RDAP (Registration Data Access Protocol) lookup tool — the modern, standardized replacement for WHOIS. Query domain, IP address, and ASN registration data. Live at [rdap.hbenali.ovh](https://rdap.hbenali.ovh).

No backend, no build step, no dependencies — it's one static `index.html` calling a public API directly from the browser.

## Features

- **Lookup** any domain, IPv4/IPv6 address, or ASN via RDAP, with automatic type detection
- **Structured view** of the response — basic info, dates, contacts/entities, nameservers, status, registry identifiers
- **Full JSON** viewer with one-click copy
- **Dark mode** with persisted preference
- Fully responsive, accessible (ARIA tabs, labeled fields), and SEO-tagged (Open Graph, Twitter Card, JSON-LD)

## Running locally

No build step required — just serve the directory:

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

## Data sources

All lookups happen client-side against a free public API:

- [rdap.org](https://rdap.org) — RDAP bootstrap redirector for domains (IANA), IPs (ARIN/RIPE/APNIC/AFRINIC/LACNIC), and ASNs

## Deployment

Deployed automatically to GitHub Pages on every push to `main` (see `.github/workflows/`).

## License

MIT — see [LICENSE](LICENSE).
