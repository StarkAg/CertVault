#!/bin/bash
# Test CertVault API actions via terminal
# Usage: ./scripts/test-certvault-api.sh

BASE="https://gradex.bond/api/certvault"

echo "=== CertVault API Tests ==="
echo ""

echo "1. verify (CV-2026-E1C75E):"
curl -s "${BASE}?action=verify&certificate_id=CV-2026-E1C75E" | python3 -m json.tool 2>/dev/null || curl -s "${BASE}?action=verify&certificate_id=CV-2026-E1C75E"
echo ""

echo "2. public-download (eventSlug=hize, names=[Vaibhavi.S]):"
curl -s -X POST "${BASE}?action=public-download" \
  -H "Content-Type: application/json" \
  -d '{"eventSlug":"hize","names":["Vaibhavi.S"]}' | python3 -m json.tool 2>/dev/null || curl -s -X POST "${BASE}?action=public-download" -H "Content-Type: application/json" -d '{"eventSlug":"hize","names":["Vaibhavi.S"]}'
echo ""

echo "3. Download PDF (if pdf_url exists):"
PDF_URL=$(curl -s "${BASE}?action=verify&certificate_id=CV-2026-E1C75E" | python3 -c "import sys,json; print(json.load(sys.stdin).get('pdf_url') or '')")
if [ -n "$PDF_URL" ]; then
  echo "  pdf_url found, downloading..."
  curl -sL "$PDF_URL" -o /tmp/cert-CV-2026-E1C75E.pdf
  echo "  Saved to /tmp/cert-CV-2026-E1C75E.pdf"
  ls -la /tmp/cert-CV-2026-E1C75E.pdf
else
  echo "  No pdf_url for this certificate. Generate PDFs from CertVault dashboard first."
fi
