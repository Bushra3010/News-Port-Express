#!/usr/bin/env python3
"""Exits non-zero when NP_CHECK is one value pasted several times over.

Nothing echoes at the password prompt, so a paste that seems not to register
gets repeated. That then fails as an authentication error, which points at the
password being wrong rather than at it being tripled.

A unit of at least four characters is required, so an ordinary password is not
mistaken for a repeat, and a final partial repeat still counts.
"""
import os
import sys

value = os.environ.get("NP_CHECK", "")
MIN_UNIT = 4

for unit in range(MIN_UNIT, len(value) // 2 + 1):
    head = value[:unit]
    repeats = -(-len(value) // unit)
    if (head * repeats)[: len(value)] == value:
        copies = len(value) / unit
        print(
            f"  That looks like the same {unit}-character value repeated "
            f"about {copies:.1f} times ({len(value)} characters in all).",
            file=sys.stderr,
        )
        sys.exit(1)

sys.exit(0)
