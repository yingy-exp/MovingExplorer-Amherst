#!/usr/bin/env python3
"""
geocode.py — Add lat/lng columns to a Nestmap CSV using Nominatim (OpenStreetMap).

Works with both:
  Databases/Amherst Housing 2026 - Sheet1.csv   (address col: "Address", town col: "Town")
  Databases/Daycare Amherst - Sheet1.csv        (address col: "Address", town col: "Town")

Usage:
  python3 geocode.py "Databases/Daycare Amherst - Sheet1.csv"
  python3 geocode.py "Databases/Amherst Housing 2026 - Sheet1.csv"

Behaviour:
  - Skips rows that already have both lat and lng filled in.
  - Skips rows with no usable address (prints a warning).
  - Writes results back to the same file in-place.
  - Respects Nominatim's 1 req/s rate limit.
"""

import csv
import io
import re
import sys
import time
import urllib.parse
import urllib.request
import json

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
USER_AGENT    = "nestmap-geocoder/1.0 (contact: wolfram)"
RATE_LIMIT_S  = 1.1   # seconds between requests


def geocode(address: str):
    """Return (lat, lng) for an address string, or (None, None) on failure."""
    params = urllib.parse.urlencode({"q": address, "format": "json", "limit": 1})
    url    = f"{NOMINATIM_URL}?{params}"
    req    = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            results = json.loads(r.read())
        if results:
            return float(results[0]["lat"]), float(results[0]["lon"])
    except Exception as e:
        print(f"    ⚠ Nominatim error: {e}")
    return None, None


def build_address(row: dict):
    """
    Try to build a geocodable address string from a CSV row.
    Falls back to combining Address + Town if the address looks incomplete.
    """
    addr = (row.get("Address") or "").strip()
    town = (row.get("Town") or "").strip()

    if addr:
        # Match ", MA" with any amount of whitespace (handles double-space exports)
        if re.search(r',\s*MA\b', addr, re.IGNORECASE):
            return addr
        # Otherwise append town + state
        parts = [addr]
        if town:
            parts.append(town)
        parts.append("MA")
        return ", ".join(parts)

    # No address — try town + state as a last resort
    if town:
        return f"{town}, MA"

    return None


def process_file(path: str) -> None:
    with open(path, newline="") as f:
        raw = f.read()

    reader  = csv.DictReader(io.StringIO(raw))
    rows    = list(reader)
    headers = list(reader.fieldnames or [])

    # Ensure lat/lng columns exist
    if "lat" not in headers:
        headers.append("lat")
    if "lng" not in headers:
        headers.append("lng")

    geocoded = skipped = already_done = 0

    for row in rows:
        lat_val = (row.get("lat") or "").strip()
        lng_val = (row.get("lng") or "").strip()

        # Skip if already geocoded
        if lat_val and lng_val:
            try:
                float(lat_val)
                float(lng_val)
                already_done += 1
                continue
            except ValueError:
                pass  # invalid value — re-geocode

        address = build_address(row)
        name    = row.get("Daycare") or row.get("Apartment Name") or "(unknown)"

        if not address:
            print(f"  ⚠ No address for '{name}' — skipping")
            skipped += 1
            continue

        print(f"  Geocoding: {name}  →  {address}")
        lat, lng = geocode(address)
        time.sleep(RATE_LIMIT_S)

        if lat is None:
            print(f"    ✗ No result found")
            skipped += 1
        else:
            row["lat"] = round(lat, 7)
            row["lng"] = round(lng, 7)
            print(f"    ✓ {lat:.6f}, {lng:.6f}")
            geocoded += 1

    # Write back
    out = io.StringIO()
    writer = csv.DictWriter(out, fieldnames=headers, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(rows)

    with open(path, "w", newline="") as f:
        f.write(out.getvalue())

    print(f"\nDone: {geocoded} geocoded, {already_done} already had coords, {skipped} skipped.")
    print(f"Saved → {path}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    process_file(sys.argv[1])
