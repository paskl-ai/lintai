# Frontend Build and Deployment Strategy

## Problem Statement

The previous approach of committing built frontend assets (`dist/` files) to git caused several issues:

1. **Constant Git Noise**: Every frontend build generates new files with different hashes, showing up as changes
2. **Repository Bloat**: Built assets increase repo size unnecessarily
3. **Merge Conflicts**: Multiple developers building creates conflicting dist files
4. **Development Friction**: Need to remember to rebuild and commit after every change

## Solution: CI/CD-Based Builds

### Overview

We now use a **build-on-release** strategy:

- ✅ **Development**: Frontend `dist/` files are gitignored
- ✅ **Releases**: CI/CD builds frontend and includes it in PyPI packages
- ✅ **Local Development**: Use `npm run dev` or build manually when needed

### How It Works

1. **During Development**:

   ```bash
   cd lintai/ui/frontend
   npm run dev  # Start dev server with hot reload
   ```

2. **For Production Testing**:

   ```bash
   python scripts/build-frontend.py  # Build locally
   python -m lintai.cli ui            # Test the built UI
   ```

3. **For Releases**:
   - CI/CD automatically builds frontend when tags are pushed
   - Built assets are included in the PyPI package
   - End users get pre-built frontend when they `pip install lintai`

### CI/CD Pipeline

See `.github/workflows/publish.yml`:

```yaml
- name: Build frontend
  run: |
    cd lintai/ui/frontend
    npm ci
    npm run build

- name: Build Python package  # Includes built frontend
  run: python -m build
```

### Benefits

✅ **Clean Git History**: No more build artifacts in commits
✅ **Faster Development**: No need to rebuild for every commit
✅ **Smaller Repository**: Only source code is tracked
✅ **Reliable Releases**: CI ensures consistent builds
✅ **Better DX**: Standard frontend development workflow

### For End Users

When users install via `pip install lintai`, they get:

- The Python CLI and libraries
- Pre-built, optimized frontend assets
- Everything works out of the box

No build tools (Node.js, npm) required for end users!

## Alternative Considered

We also considered building during `pip install`, but this approach is more reliable because:

- Users don't need Node.js/npm installed
- No build failures during installation
- Consistent, tested builds
- Faster installation for users

## Migration

To migrate from the old approach:

1. ✅ Updated `.gitignore` to exclude `dist/` files
2. ✅ Removed existing `dist/` files from git tracking
3. ✅ Created CI/CD pipeline for releases
4. ✅ Updated `pyproject.toml` to include built assets in packages
5. ✅ Added development build script for local testing

This ensures a smooth transition while solving all the original issues.
