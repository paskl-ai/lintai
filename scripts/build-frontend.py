#!/usr/bin/env python3
"""
Development build script for the frontend.
Run this during development to build the frontend locally.
"""

import subprocess
import sys
from pathlib import Path


def main():
    """Build the frontend for development."""
    # Go up from scripts/ to project root, then to frontend
    frontend_dir = Path(__file__).parent.parent / "lintai" / "ui" / "frontend"

    if not frontend_dir.exists():
        print("❌ Frontend directory not found!")
        sys.exit(1)

    print("🔧 Building frontend for development...")

    try:
        # Install dependencies if needed
        if not (frontend_dir / "node_modules").exists():
            print("📦 Installing dependencies...")
            subprocess.run(
                ["yarn", "install", "--frozen-lockfile"], cwd=frontend_dir, check=True
            )

        # Build
        print("🏗️  Building...")
        subprocess.run(["yarn", "build"], cwd=frontend_dir, check=True)

        print("✅ Frontend build completed!")
        print(f"📁 Built files are in: {frontend_dir / 'dist'}")

    except subprocess.CalledProcessError as e:
        print(f"❌ Build failed: {e}")
        sys.exit(1)
    except FileNotFoundError:
        print("❌ yarn not found. Please install Node.js and yarn.")
        sys.exit(1)


if __name__ == "__main__":
    main()
