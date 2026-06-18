# Saga Architect - Packaging Guide

**Package ID:** com.bobbysworld.sagaarchitect
**Product:** Saga Architect
**Version:** 0.1.0 (MVP)

---

## Overview

This guide covers packaging Saga Architect for different platforms within the **Bobby's World / Blue Phoenix OS** ecosystem.

Supported platforms:
- **Web** (Vercel, Netlify, self-hosted)
- **Windows** (MSIX/Appx package)
- **Blue Phoenix OS** (native integration)

---

## Prerequisites

### All Platforms
- Node.js 20 or higher
- npm or yarn
- Git

### Windows MSIX
- Windows 10/11 SDK
- Visual Studio 2022 (Community or higher)
- MSIX Packaging Tool or Windows Application Packaging Project

### Blue Phoenix OS
- Blue Phoenix OS development environment
- BP OS SDK (consult BP OS documentation)

---

## Web Deployment

### 1. Vercel (Recommended)

Saga Architect is optimized for Vercel deployment.

#### Quick Deploy

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy from project root
vercel

# Follow prompts to:
# - Link to your Vercel account
# - Configure project settings
# - Set environment variables (optional: OPENAI_API_KEY)
```

#### Environment Variables

Set in Vercel dashboard → Settings → Environment Variables:

```
OPENAI_API_KEY=your_openai_api_key_here  # Optional for AI features
```

#### Production Build

```bash
# Build locally to test
npm run build

# Deploy to production
vercel --prod
```

---

### 2. Netlify

#### netlify.toml Configuration

Create `netlify.toml` in project root:

```toml
[build]
  command = "npm run build"
  publish = ".next"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

#### Deploy Steps

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login to Netlify
netlify login

# Initialize site
netlify init

# Deploy
netlify deploy --prod
```

---

### 3. Self-Hosted (Docker)

#### Dockerfile

Create `Dockerfile` in project root:

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV production

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
ENV PORT 3000

CMD ["node", "server.js"]
```

#### Build and Run

```bash
# Build Docker image
docker build -t saga-architect:latest .

# Run container
docker run -p 3000:3000 \
  -e OPENAI_API_KEY=your_key_here \
  saga-architect:latest
```

---

## Windows MSIX Package

### Overview

MSIX is the modern Windows app package format, compatible with Windows 10/11 and the Microsoft Store.

### Prerequisites

- Windows 10/11 SDK installed
- Visual Studio 2022 with "Desktop development with C++" workload
- MSIX Packaging Tool (optional, for automated packaging)

### Option 1: Visual Studio Packaging Project

#### Step 1: Build Next.js App

```bash
# Build production version
npm run build

# Create standalone output
# Add to next.config.ts:
# output: 'standalone'

npm run build
```

#### Step 2: Create Windows Application Packaging Project

1. Open Visual Studio 2022
2. File → New → Project
3. Select "Windows Application Packaging Project"
4. Name: "SagaArchitect.Package"
5. Right-click project → Add → Existing Project
6. Add a new "Console App" project to wrap the Next.js server

#### Step 3: Configure Package Manifest

Edit `Package.appxmanifest`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<Package xmlns="http://schemas.microsoft.com/appx/manifest/foundation/windows10"
         xmlns:uap="http://schemas.microsoft.com/appx/manifest/uap/windows10"
         xmlns:rescap="http://schemas.microsoft.com/appx/manifest/foundation/windows10/restrictedcapabilities">
  <Identity Name="com.bobbysworld.sagaarchitect"
            Publisher="CN=BobbysWorld"
            Version="0.1.0.0" />

  <Properties>
    <DisplayName>Saga Architect</DisplayName>
    <PublisherDisplayName>Bobby's World</PublisherDisplayName>
    <Logo>Assets\StoreLogo.png</Logo>
  </Properties>

  <Dependencies>
    <TargetDeviceFamily Name="Windows.Desktop" MinVersion="10.0.17763.0" MaxVersionTested="10.0.22621.0" />
  </Dependencies>

  <Resources>
    <Resource Language="en-us" />
  </Resources>

  <Applications>
    <Application Id="SagaArchitect"
                 Executable="$targetnametoken$.exe"
                 EntryPoint="$targetentrypoint$">
      <uap:VisualElements
        DisplayName="Saga Architect"
        Description="Universe Bible + Canon Engine for Creators"
        BackgroundColor="transparent"
        Square150x150Logo="Assets\Square150x150Logo.png"
        Square44x44Logo="Assets\Square44x44Logo.png">
        <uap:DefaultTile Wide310x150Logo="Assets\Wide310x150Logo.png" />
      </uap:VisualElements>
    </Application>
  </Applications>

  <Capabilities>
    <Capability Name="internetClient" />
    <rescap:Capability Name="runFullTrust" />
  </Capabilities>
</Package>
```

#### Step 4: Build MSIX

```bash
# In Visual Studio
# Right-click packaging project → Store → Create App Packages
# Follow wizard to generate .msix file
```

---

### Option 2: MSIX Packaging Tool (GUI)

1. Download **MSIX Packaging Tool** from Microsoft Store
2. Launch the tool
3. Select "Application package"
4. Choose "Create package on this computer"
5. Follow wizard:
   - Select installer or executable
   - Choose package information
   - Configure capabilities
   - Sign package (optional for development)

---

### Option 3: Command-Line MSIX

#### Create Package Structure

```
SagaArchitect/
├── AppxManifest.xml
├── Assets/
│   ├── Square150x150Logo.png
│   ├── Square44x44Logo.png
│   └── StoreLogo.png
├── VFS/
│   └── ProgramFilesX64/
│       └── SagaArchitect/
│           ├── .next/
│           ├── node_modules/
│           ├── package.json
│           └── server.js
└── SagaArchitect.exe  (launcher)
```

#### Build MSIX

```powershell
# Create MSIX package
MakeAppx.exe pack /d "C:\SagaArchitect" /p "SagaArchitect.msix"

# Sign package (development)
SignTool.exe sign /fd SHA256 /a /f "C:\cert.pfx" /p "password" "SagaArchitect.msix"
```

---

### Testing MSIX Package

```powershell
# Install package (development mode)
Add-AppxPackage -Path "SagaArchitect.msix"

# Launch app
# Start menu → Saga Architect

# Uninstall
Remove-AppxPackage -Package "com.bobbysworld.sagaarchitect_0.1.0.0_x64__8wekyb3d8bbwe"
```

---

## Blue Phoenix OS Integration

### Overview

Blue Phoenix OS is Bobby's World custom operating system. Saga Architect integrates natively with BP OS features.

### Package Format

Blue Phoenix OS uses `.bpos` package format (based on container technology).

### Prerequisites

1. **BP OS SDK** - Install from BP OS developer portal
2. **BP OS CLI** - Command-line tools for packaging
3. **BP OS Account** - Developer account for signing

### Package Structure

```
saga-architect.bpos/
├── manifest.json           # BP OS package manifest
├── metadata.json           # App metadata (app.metadata.json)
├── app/                    # Application files
│   ├── .next/
│   ├── node_modules/
│   ├── public/
│   └── package.json
├── scripts/
│   ├── install.sh          # Installation script
│   ├── uninstall.sh        # Cleanup script
│   └── run.sh              # Launcher script
└── resources/
    ├── icon.png            # App icon (512x512)
    └── banner.png          # Store banner
```

### manifest.json (BP OS Format)

```json
{
  "package_id": "com.bobbysworld.sagaarchitect",
  "name": "Saga Architect",
  "version": "0.1.0",
  "type": "webapp",
  "ecosystem": "bobbys_world",
  "category": "creativity",
  "entry_point": "scripts/run.sh",
  "permissions": [
    "network.http",
    "storage.local",
    "clipboard.write"
  ],
  "dependencies": {
    "runtime": "node:20",
    "packages": ["node", "npm"]
  },
  "integration": {
    "quick_launch": true,
    "system_tray": false,
    "autostart": false
  }
}
```

### scripts/run.sh

```bash
#!/bin/bash
# Saga Architect launcher for Blue Phoenix OS

# Set environment
export NODE_ENV=production
export PORT=3000

# Start server
cd /opt/saga-architect/app
node .next/standalone/server.js
```

### Building BP OS Package

```bash
# Install BP OS CLI
bpos-cli install

# Login to BP OS developer portal
bpos-cli login

# Build package
bpos-cli build --manifest manifest.json --output saga-architect.bpos

# Test package locally
bpos-cli test saga-architect.bpos

# Sign package
bpos-cli sign saga-architect.bpos --cert /path/to/cert.pem

# Publish to BP OS Store
bpos-cli publish saga-architect.bpos
```

### Installation on BP OS

```bash
# Install from BP OS Store
bpos-cli install com.bobbysworld.sagaarchitect

# Or install from file
bpos-cli install saga-architect.bpos

# Launch app
bpos-cli launch com.bobbysworld.sagaarchitect

# Uninstall
bpos-cli uninstall com.bobbysworld.sagaarchitect
```

---

## Platform-Specific Notes

### Web
- **Pros:** Easiest deployment, no installation required, automatic updates
- **Cons:** Requires internet, limited offline support
- **Best for:** Quick demos, public access, cloud deployment

### Windows MSIX
- **Pros:** Native Windows integration, Microsoft Store support, sandboxed
- **Cons:** More complex packaging, requires Windows 10+
- **Best for:** Enterprise deployment, offline usage, Windows-first users

### Blue Phoenix OS
- **Pros:** Deep OS integration, Bobby's World ecosystem features, native performance
- **Cons:** Limited to BP OS users, requires BP OS SDK
- **Best for:** Bobby's World ecosystem integration, power users

---

## Distribution Checklist

Before distributing any package:

- [ ] Run `npm run build` to verify build works
- [ ] Run `npm run lint` to check for errors
- [ ] Run `./scripts/healthcheck.sh` to verify functionality
- [ ] Run `./scripts/smoke-test.sh` to verify core features
- [ ] Test package installation on target platform
- [ ] Verify app launches without errors
- [ ] Test core workflows (create universe, add characters, export)
- [ ] Update version in `package.json` and `app.metadata.json`
- [ ] Generate release notes
- [ ] Sign package (production only)

---

## Signing & Certificates

### Windows Code Signing

```powershell
# Generate self-signed certificate (development only)
New-SelfSignedCertificate -Type CodeSigningCert -Subject "CN=BobbysWorld" -CertStoreLocation Cert:\CurrentUser\My

# Sign MSIX
SignTool.exe sign /fd SHA256 /a /f cert.pfx /p password SagaArchitect.msix
```

### BP OS Signing

```bash
# Generate BP OS signing key
bpos-cli keygen --output saga-architect.key

# Sign package
bpos-cli sign saga-architect.bpos --key saga-architect.key
```

---

## Troubleshooting

### Build Fails

```bash
# Clear cache
rm -rf .next node_modules package-lock.json

# Reinstall dependencies
npm install

# Rebuild
npm run build
```

### MSIX Installation Fails

```powershell
# Enable developer mode
Settings → Update & Security → For Developers → Developer Mode

# Install certificate
certutil -addstore root cert.cer

# Retry installation
Add-AppxPackage -Path SagaArchitect.msix
```

### BP OS Package Errors

```bash
# Verify manifest
bpos-cli validate manifest.json

# Check logs
bpos-cli logs com.bobbysworld.sagaarchitect

# Reinstall
bpos-cli uninstall com.bobbysworld.sagaarchitect
bpos-cli install saga-architect.bpos
```

---

## Support

**Repository:** https://github.com/Bboy9090/SagaArchitect
**Issues:** https://github.com/Bboy9090/SagaArchitect/issues
**BP OS Docs:** (consult Blue Phoenix OS documentation)

---

**Last Updated:** May 2026
**Document Owner:** Bobby's World Team
