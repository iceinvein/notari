# Notari Setup Guide

This guide covers setting up the development environment and configuring code signing for macOS.

## Prerequisites

### Required Software

1. **Node.js 18+**
   ```bash
   # Check version
   node --version
   
   # Install via Homebrew (recommended)
   brew install node@18
   ```

2. **pnpm**
   ```bash
   # Install globally
   npm install -g pnpm
   
   # Verify installation
   pnpm --version
   ```

3. **Rust Toolchain**
   ```bash
   # Install via rustup
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   
   # Verify installation
   rustc --version
   cargo --version
   ```

4. **Xcode Command Line Tools** (macOS only)
   ```bash
   # Install
   xcode-select --install
   
   # Verify installation
   xcode-select -p
   # Should output: /Library/Developer/CommandLineTools
   ```

5. **Swift Compiler** (macOS only)
   ```bash
   # Verify Swift is available (comes with Xcode Command Line Tools)
   swift --version
   # Should output: Apple Swift version 5.x
   ```

### System Requirements

- **macOS 12.3+** (Monterey or later) - Required for ScreenCaptureKit API
- **Xcode 13.3+** or Xcode Command Line Tools
- **Apple Developer Account** (for code signing)

## Initial Setup

### 1. Clone Repository

```bash
git clone https://github.com/your-org/notari.git
cd notari
```

### 2. Install Dependencies

```bash
# Install Node.js dependencies
pnpm install

# Rust dependencies are managed by Cargo and will be installed on first build
```

### 3. Build Swift Sidecar

The Swift sidecar is built automatically during `pnpm tauri dev` or `pnpm tauri build`, but you can build it manually:

```bash
cd src-tauri/sidecar
./build.sh
```

This creates `src-tauri/bin/sck-recorder` (or `sck-recorder-aarch64-apple-darwin` for Apple Silicon).

## Code Signing (macOS)

### Why Code Signing is Required

macOS requires code signing for:
- **ScreenCaptureKit API access** - Unsigned apps cannot use screen capture
- **Hardened Runtime** - Required for distribution
- **Notarization** - Required for distribution outside Mac App Store
- **Gatekeeper** - Allows users to run the app without security warnings

### Apple Developer Account Setup

1. **Enroll in Apple Developer Program**
   - Visit [developer.apple.com](https://developer.apple.com)
   - Enroll as an individual or organization ($99/year)
   - Wait for approval (usually 24-48 hours)

2. **Install Developer Certificate**
   - Open Xcode or visit [developer.apple.com/account/resources/certificates](https://developer.apple.com/account/resources/certificates)
   - Create a **Developer ID Application** certificate (for distribution outside Mac App Store)
   - Or create an **Apple Development** certificate (for development)
   - Download and install the certificate (double-click to add to Keychain)

3. **Verify Certificate Installation**
   ```bash
   # List available signing identities
   security find-identity -v -p codesigning
   
   # Should show something like:
   # 1) ABC123... "Apple Development: Your Name (TEAM_ID)"
   # 2) DEF456... "Developer ID Application: Your Name (TEAM_ID)"
   ```

### Configure Code Signing

1. **Update `tauri.conf.json`**

   Edit `src-tauri/tauri.conf.json`:

   ```json
   {
     "bundle": {
       "macOS": {
         "signingIdentity": "Apple Development: Your Name (TEAM_ID)",
         "hardenedRuntime": true,
         "entitlements": "entitlements.plist"
       }
     }
   }
   ```

   Replace `"Apple Development: Your Name (TEAM_ID)"` with your actual signing identity from step 3 above.

2. **Entitlements Configuration**

   The `src-tauri/entitlements.plist` file is already configured with required entitlements:

   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
   <plist version="1.0">
   <dict>
       <!-- Screen recording and capture -->
       <key>com.apple.security.device.camera</key>
       <true/>
       <key>com.apple.security.device.microphone</key>
       <true/>
       <key>com.apple.security.device.audio-input</key>
       <true/>

       <!-- Required for Tauri with hardened runtime -->
       <key>com.apple.security.cs.allow-jit</key>
       <true/>
       <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
       <true/>
       <key>com.apple.security.cs.allow-dyld-environment-variables</key>
       <true/>
       <key>com.apple.security.cs.disable-library-validation</key>
       <true/>

       <!-- Network access (for video server) -->
       <key>com.apple.security.network.client</key>
       <true/>
       <key>com.apple.security.network.server</key>
       <true/>

       <!-- File system access -->
       <key>com.apple.security.files.user-selected.read-write</key>
       <true/>
       <key>com.apple.security.files.downloads.read-write</key>
       <true/>
   </dict>
   </plist>
   ```

   **Key Entitlements**:
   - `com.apple.security.device.camera` - Required for ScreenCaptureKit
   - `com.apple.security.device.microphone` - Required for audio capture (future)
   - `com.apple.security.cs.allow-jit` - Required for Tauri's JavaScript engine
   - `com.apple.security.network.server` - Required for video streaming server
   - `com.apple.security.files.user-selected.read-write` - Required for saving recordings

### Verify Code Signing

After building, verify the app is properly signed:

```bash
# Build the app
pnpm tauri build

# Check code signature
codesign -dv --verbose=4 src-tauri/target/release/bundle/macos/notari-tray.app

# Should show:
# Identifier=com.notari.tray
# Authority=Apple Development: Your Name (TEAM_ID)
# ...
# Signature=adhoc (or your certificate)

# Verify entitlements
codesign -d --entitlements - src-tauri/target/release/bundle/macos/notari-tray.app
```

## Screen Recording Permission

### First Run Setup

1. **Launch the app**
   ```bash
   pnpm tauri dev
   # or
   open src-tauri/target/release/bundle/macos/notari-tray.app
   ```

2. **Grant Screen Recording Permission**
   - macOS will prompt for Screen Recording permission
   - Or manually: System Settings → Privacy & Security → Screen Recording
   - Enable permission for "notari-tray"
   - **Restart the app** after granting permission

3. **Verify Permission**
   - Open the app
   - The permission status should show "Granted" in Settings → Dev/Logging

### Troubleshooting Permissions

If screen recording doesn't work:

1. **Check permission status**
   ```bash
   # Check if app is in TCC database
   sqlite3 ~/Library/Application\ Support/com.apple.TCC/TCC.db \
     "SELECT * FROM access WHERE service='kTCCServiceScreenCapture';"
   ```

2. **Reset permissions** (if needed)
   ```bash
   # Reset all permissions for the app
   tccutil reset ScreenCapture com.notari.tray
   ```

3. **Restart the app** after any permission changes

## Development Workflow

### Running in Development Mode

```bash
# Start development server with hot reload
pnpm tauri dev
```

This will:
1. Start Vite dev server on `http://localhost:5173`
2. Build Rust backend
3. Build Swift sidecar
4. Launch the app with hot reload enabled

### Building for Production

```bash
# Build optimized production bundle
pnpm tauri build
```

Output locations:
- **App bundle**: `src-tauri/target/release/bundle/macos/notari-tray.app`
- **DMG installer**: `src-tauri/target/release/bundle/dmg/notari-tray_0.1.0_aarch64.dmg`

### Building Swift Sidecar Manually

```bash
cd src-tauri/sidecar
./build.sh

# Output: ../bin/sck-recorder-aarch64-apple-darwin
```

### Running Tests

```bash
# Rust tests
cd src-tauri
cargo test

# Frontend tests (if configured)
pnpm test
```

## Notarization (Optional)

For distribution outside the Mac App Store, you need to notarize the app.

### Prerequisites

- Apple Developer Account
- App-specific password for notarization
- Developer ID Application certificate

### Setup Notarization

1. **Create App-Specific Password**
   - Visit [appleid.apple.com](https://appleid.apple.com)
   - Sign in → Security → App-Specific Passwords
   - Generate new password
   - Save it securely

2. **Set Environment Variables**
   ```bash
   export APPLE_ID="your-apple-id@example.com"
   export APPLE_PASSWORD="your-app-specific-password"
   export APPLE_TEAM_ID="YOUR_TEAM_ID"
   ```

3. **Build and Notarize**
   ```bash
   pnpm tauri build
   
   # Tauri will automatically notarize if environment variables are set
   ```

4. **Verify Notarization**
   ```bash
   spctl -a -vv src-tauri/target/release/bundle/macos/notari-tray.app
   
   # Should show: "accepted" and "source=Notarized Developer ID"
   ```

## Common Issues

### Issue: "Developer cannot be verified"

**Cause**: App is not signed or notarized

**Solution**:
1. Configure code signing (see above)
2. Or bypass Gatekeeper for development:
   ```bash
   xattr -cr src-tauri/target/release/bundle/macos/notari-tray.app
   ```

### Issue: "Screen recording permission denied"

**Cause**: Permission not granted or app needs restart

**Solution**:
1. Open System Settings → Privacy & Security → Screen Recording
2. Enable permission for "notari-tray"
3. **Restart the app** (important!)

### Issue: "Swift sidecar not found"

**Cause**: Sidecar not built or in wrong location

**Solution**:
```bash
cd src-tauri/sidecar
./build.sh
ls -la ../bin/sck-recorder*
```

### Issue: "Code signing failed"

**Cause**: Certificate not installed or wrong identity

**Solution**:
1. Verify certificate: `security find-identity -v -p codesigning`
2. Update `tauri.conf.json` with correct identity
3. Ensure certificate is valid and not expired

### Issue: "Hardened runtime error"

**Cause**: Missing entitlements

**Solution**:
1. Verify `entitlements.plist` exists
2. Check `tauri.conf.json` references it correctly
3. Rebuild the app

## Environment Variables

Optional environment variables for development:

```bash
# Rust logging
export RUST_LOG=debug

# Tauri development
export TAURI_DEBUG=1

# Skip notarization (development only)
unset APPLE_ID
unset APPLE_PASSWORD
unset APPLE_TEAM_ID
```

## Next Steps

After setup:

1. Read [docs/ARCHITECTURE.md](ARCHITECTURE.md) for system overview
2. Read [docs/recording.md](recording.md) for recording system details
3. Read [docs/encryption.md](encryption.md) for encryption system details
4. Check [docs/dev/](dev/) for developer guides

## Resources

- [Tauri Documentation](https://tauri.app/v2/)
- [Apple Developer Documentation](https://developer.apple.com/documentation/)
- [ScreenCaptureKit Documentation](https://developer.apple.com/documentation/screencapturekit)
- [Code Signing Guide](https://developer.apple.com/support/code-signing/)
- [Notarization Guide](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)

