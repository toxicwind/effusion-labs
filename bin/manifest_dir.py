#!/usr/bin/env python3
"""Emit a deterministic manifest of files with size and sha256.

Output format (one per line):
<sha256> <size> <path>
"""

from __future__ import annotations

import argparse
import hashlib
import os
import sys


def _iter_files(root: str):
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames.sort()
        filenames.sort()
        for name in filenames:
            path = os.path.join(dirpath, name)
            if os.path.islink(path):
                continue
            rel = os.path.relpath(path, root)
            yield rel, path


def _hash_file(path: str) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Manifest a directory.")
    parser.add_argument("root", help="Root directory to scan")
    args = parser.parse_args(argv)

    root = os.path.abspath(args.root)
    if not os.path.isdir(root):
        print(f"Not a directory: {root}", file=sys.stderr)
        return 2

    for rel, path in _iter_files(root):
        size = os.path.getsize(path)
        sha = _hash_file(path)
        print(f"{sha} {size} {rel}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
