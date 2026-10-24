# DLMS IPv6 Meter Reader — Hosted Preview

Static GitHub Pages edition of the DLMS IPv6 Meter Reader interface.

## Supported in the hosted page

- Meter route input in `label,IPv6,port` format
- IPv6, TCP-port, and duplicate validation
- Sequential browser simulation
- Downloadable text report
- Responsive desktop/mobile layout

## Important boundary

A browser page cannot directly open the raw TCP connection required by DLMS/COSEM meters. This hosted version does not contact meters and does not collect meter credentials. Live reads require the separately packaged Windows/macOS desktop application or an authorized HTTPS gateway located inside the meter network.

No production meter addresses, passwords, or cryptographic keys belong in this repository.

## Local preview

Serve the repository directory with any static HTTP server. For example:

```bash
python3 -m http.server 8766
```

Then open `http://127.0.0.1:8766/`.
