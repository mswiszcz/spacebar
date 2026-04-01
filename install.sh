#!/usr/bin/env bash
set -euo pipefail

# Spacebar Installer
# Installs the Spacebar.app and spacebar CLI

VERSION="${SPACEBAR_VERSION:-0.4.0}"
REPO="mswiszcz/spacebar"
APP_NAME="Spacebar.app"
CLI_NAME="spacebar"
INSTALL_DIR="/Applications"
CLI_DIR="/usr/local/bin"

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

info()  { echo -e "${BLUE}==>${NC} ${BOLD}$1${NC}"; }
ok()    { echo -e "${GREEN}==>${NC} ${BOLD}$1${NC}"; }
err()   { echo -e "${RED}error:${NC} $1" >&2; exit 1; }

# Check platform
[[ "$(uname -s)" == "Darwin" ]] || err "Spacebar is macOS only."

ARCH="$(uname -m)"
case "$ARCH" in
  arm64)  ARCH_SUFFIX="aarch64" ;;
  x86_64) ARCH_SUFFIX="x86_64" ;;
  *)      err "Unsupported architecture: $ARCH" ;;
esac

TARBALL="Spacebar_${ARCH_SUFFIX}.tar.gz"
DOWNLOAD_URL="https://github.com/${REPO}/releases/download/v${VERSION}/${TARBALL}"

TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

info "Downloading Spacebar v${VERSION} for ${ARCH}..."
if command -v curl &>/dev/null; then
  curl -fSL "$DOWNLOAD_URL" -o "$TMPDIR/$TARBALL" || err "Download failed. Check that release v${VERSION} exists."
elif command -v wget &>/dev/null; then
  wget -q "$DOWNLOAD_URL" -O "$TMPDIR/$TARBALL" || err "Download failed. Check that release v${VERSION} exists."
else
  err "curl or wget required."
fi

info "Extracting..."
tar -xzf "$TMPDIR/$TARBALL" -C "$TMPDIR"

# Install app
info "Installing ${APP_NAME} to ${INSTALL_DIR}..."
if [[ -d "${INSTALL_DIR}/${APP_NAME}" ]]; then
  info "Removing existing ${APP_NAME}..."
  rm -rf "${INSTALL_DIR}/${APP_NAME}"
fi
cp -R "$TMPDIR/${APP_NAME}" "$INSTALL_DIR/"

# Install CLI
info "Installing ${CLI_NAME} CLI to ${CLI_DIR}..."
sudo mkdir -p "$CLI_DIR"
sudo cp "$TMPDIR/${CLI_NAME}" "$CLI_DIR/${CLI_NAME}"
sudo chmod +x "$CLI_DIR/${CLI_NAME}"

ok "Spacebar v${VERSION} installed!"
echo ""
echo "  App:  ${INSTALL_DIR}/${APP_NAME}"
echo "  CLI:  ${CLI_DIR}/${CLI_NAME}"
echo ""
echo "  Launch Spacebar from Applications, then use the CLI:"
echo "    spacebar health"
echo "    spacebar register --agent claude-code --session-id test --on-click \"open -a Terminal\""
echo ""
echo "  See the README for Claude Code hooks setup."
