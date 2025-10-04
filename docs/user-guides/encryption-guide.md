# Encryption User Guide

## Quick Start

Notari offers two ways to encrypt your screen recordings:

1. **Password Encryption** - Simple password protection
2. **Public Key Encryption** - Secure sharing without password exchange

## Password Encryption

### When to Use

- You want simple password protection
- You'll share the password separately (e.g., in person, phone call)
- You're the only person who needs to view the recording

### How to Record with Password

1. Open Notari and go to the **Record** tab
2. Enable the **Encryption** toggle
3. Select **Password** as the encryption method
4. Enter a strong password (min 8 characters, uppercase, lowercase, number)
5. Select a window to record
6. Start recording

### How to Play Password-Encrypted Videos

1. Go to the **Recordings** tab
2. Click on an encrypted recording (shows 🔒 icon)
3. Enter the password when prompted
4. Video plays automatically after successful decryption

### Password Tips

✅ **Do**:
- Use a strong, unique password
- Store password in a password manager
- Share password through a secure channel (not email)

❌ **Don't**:
- Use common passwords or personal information
- Share password in the same channel as the video
- Forget your password (cannot be recovered!)

## Public Key Encryption

### When to Use

- You want to share recordings securely with specific people
- You don't want to exchange passwords
- You want recipients to view videos automatically
- You're recording for yourself and want seamless playback

### One-Time Setup: Generate Your Key

**First time only:**

1. Go to **Settings** → **Security** tab
2. Click **Generate Encryption Key**
3. Your key is securely stored in your system keychain
4. Click **Manage Keys** to view your public key

### Share Your Public Key

To receive encrypted videos, share your public key with others:

1. Go to **Settings** → **Security** → **Manage Keys**
2. Choose how to share:
   - **Copy to Clipboard** - Paste into email/chat
   - **Download as File** - Send as attachment
   - **Show QR Code** - Scan with mobile device

**Note**: Your public key is safe to share openly. Only your private key (stored securely in keychain) can decrypt videos.

### How to Record with Public Key Encryption

1. Open Notari and go to the **Record** tab
2. Enable the **Encryption** toggle
3. Select **Public Key** as the encryption method
4. Add recipients:
   - Click **Add Myself** to encrypt for yourself
   - Click **Add Recipient** to add others
   - Paste their public key or load from file
5. Select a window to record
6. Start recording

### How to Play Public Key Encrypted Videos

**If you're a recipient:**

1. Go to the **Recordings** tab
2. Click on an encrypted recording (shows 🔒 icon)
3. Video plays automatically - no password needed!

**Behind the scenes:**
- Your private key is retrieved from the keychain
- The video key is decrypted automatically
- Video plays seamlessly

### Managing Recipients

**Adding Multiple Recipients:**
- You can add multiple recipients when recording
- Each recipient can decrypt independently
- Recipients don't know who else can decrypt

**Removing Recipients:**
- Cannot remove recipients from existing recordings
- Record a new video with updated recipient list

## Comparing Encryption Methods

| Feature | Password | Public Key |
|---------|----------|------------|
| **Setup** | None | One-time key generation |
| **Playback** | Enter password each time | Automatic (no password) |
| **Sharing** | Share password separately | Share public key once |
| **Multiple Recipients** | Everyone uses same password | Each recipient has own key |
| **Security** | Depends on password strength | Strong cryptography (X25519) |
| **Recovery** | Lost password = lost video | Lost private key = lost video |
| **Best For** | Personal use, simple sharing | Team collaboration, frequent sharing |

## Security Best Practices

### For Password Encryption

1. **Use Strong Passwords**
   - Minimum 8 characters
   - Mix of uppercase, lowercase, numbers
   - Avoid dictionary words

2. **Secure Password Sharing**
   - Use encrypted messaging (Signal, WhatsApp)
   - Share in person or via phone call
   - Never email passwords

3. **Password Storage**
   - Use a password manager
   - Don't reuse passwords
   - Keep backup of important passwords

### For Public Key Encryption

1. **Protect Your Private Key**
   - Never share your private key
   - Keep your system password secure
   - Enable biometric authentication if available

2. **Verify Public Keys**
   - Verify recipient's public key out-of-band
   - Compare key fingerprints in person or via video call
   - Be cautious of keys received via untrusted channels

3. **Key Backup**
   - Consider backing up your private key securely
   - Store backup in encrypted password manager
   - Test backup restoration process

4. **Key Rotation**
   - Generate new keys periodically
   - Old videos remain encrypted with old key
   - Share new public key with collaborators

## Troubleshooting

### "Invalid password" error

**Problem**: Password doesn't work

**Solutions**:
- Check for typos (passwords are case-sensitive)
- Verify Caps Lock is off
- Try copying/pasting password
- Confirm you're using the correct password for this recording

### "No encryption key found" error

**Problem**: Private key missing from keychain

**Solutions**:
- Go to Settings → Security → Generate Encryption Key
- If you had a key before, it may have been deleted
- Restore from backup if available
- Note: Cannot decrypt old videos without original key

### Video shows lock icon but asks for password

**Problem**: Public key encrypted video prompting for password

**Solutions**:
- Ensure you're using the latest version of Notari
- Restart the application
- Check Settings → Dev/Logging for errors
- Verify you were added as a recipient when video was recorded

### Cannot add recipient

**Problem**: "Invalid public key" error

**Solutions**:
- Verify public key format (base64 encoded)
- Ensure complete key was copied (no truncation)
- Try loading from file instead of pasting
- Ask recipient to re-export their public key

## FAQ

**Q: Can I change the password on an encrypted video?**

A: No, videos cannot be re-encrypted with a different password. You would need to decrypt and re-record.

**Q: Can I add more recipients to an existing recording?**

A: No, recipients are set at recording time and cannot be changed. Record a new video with updated recipients.

**Q: What happens if I lose my private key?**

A: Videos encrypted for you cannot be decrypted. There is no recovery mechanism. Keep secure backups!

**Q: Can someone decrypt my videos if they steal my computer?**

A: If your system is unlocked, yes. The keychain is accessible when logged in. Use full disk encryption and lock your computer when away.

**Q: Is public key encryption more secure than password encryption?**

A: Both are secure if used correctly. Public key encryption eliminates password sharing risks but requires proper key management.

**Q: Can I use both encryption methods?**

A: Not simultaneously. Choose one method per recording. You can use different methods for different recordings.

**Q: How do I know if a video is encrypted?**

A: Encrypted videos show a 🔒 lock icon in the recordings library.

**Q: Can I decrypt videos on a different computer?**

A: For password encryption: Yes, enter the password. For public key encryption: Only if your private key is available on that computer.

## Getting Help

If you encounter issues:

1. Check Settings → Dev/Logging for error messages
2. Verify you're using the latest version
3. Review this guide for common solutions
4. Report bugs with log details

## Technical Details

For developers and advanced users, see:
- [Encryption Architecture](../encryption.md) - Technical implementation details
- [Encryption Implementation](../dev/encryption-implementation.md) - Code-level documentation
- [Encryption Quick Reference](../dev/encryption-quick-reference.md) - API reference

