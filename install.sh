#!/bin/sh
# Installs pane, a small local code viewer and editor.
#
#   curl -fsSL https://raw.githubusercontent.com/nikhilnigamnik/pane/main/install.sh | sh
#
# Settings, all optional:
#   PANE_VERSION        version to install, such as 0.2.0 (default: the latest release)
#   PANE_INSTALL_DIR    folder for the pane command (default: ~/.local/bin)
#   PANE_DOWNLOAD_BASE  where the release files are fetched from (default: GitHub releases)

# Everything runs from main, called on the last line, so a download cut off halfway runs nothing.

set -eu

REPO="nikhilnigamnik/pane"
NAME="pane"

say() {
  printf '%s\n' "$1"
}

fail() {
  printf 'error: %s\n' "$1" >&2
  exit 1
}

detect_target() {
  case "$(uname -s)" in
    Darwin) os="darwin" ;;
    Linux) os="linux" ;;
    *) fail "pane has builds for macOS and Linux only." ;;
  esac

  case "$(uname -m)" in
    x86_64 | amd64) arch="x64" ;;
    arm64 | aarch64) arch="arm64" ;;
    *) fail "pane has no build for $(uname -m) processors." ;;
  esac

  # A shell running under Rosetta reports x86_64 on Apple Silicon. The native build is faster.
  if [ "$os" = "darwin" ] && [ "$arch" = "x64" ] &&
    [ "$(sysctl -n sysctl.proc_translated 2>/dev/null || true)" = "1" ]; then
    arch="arm64"
  fi

  if [ "$os" = "linux" ] && ldd --version 2>&1 | grep -qi musl; then
    fail "pane's Linux builds need glibc. Alpine and other musl systems are not supported yet."
  fi

  printf '%s-%s' "$os" "$arch"
}

download() {
  curl -fsSL --retry 2 --connect-timeout 15 -o "$2" "$1" || fail "could not download $1"
}

sha256_of() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | cut -d ' ' -f 1
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | cut -d ' ' -f 1
  else
    fail "found neither sha256sum nor shasum to check the download."
  fi
}

# The first of these folders that is already on PATH, so the command works right away.
default_install_dir() {
  for dir in "$HOME/.local/bin" "$HOME/bin"; do
    case ":$PATH:" in
      *":$dir:"*)
        printf '%s' "$dir"
        return
        ;;
    esac
  done
  printf '%s' "$HOME/.local/bin"
}

shell_profile() {
  case "$(basename "${SHELL:-sh}")" in
    zsh) printf '%s' "~/.zshrc" ;;
    bash) printf '%s' "~/.bashrc" ;;
    *) printf '%s' "~/.profile" ;;
  esac
}

main() {
  command -v curl >/dev/null 2>&1 || fail "curl is needed to download pane."
  command -v tar >/dev/null 2>&1 || fail "tar is needed to unpack pane."

  target=$(detect_target)
  archive="$NAME-$target.tar.gz"

  version="${PANE_VERSION:-}"
  version="${version#v}"
  if [ -n "$version" ]; then
    base="https://github.com/$REPO/releases/download/v$version"
  else
    base="https://github.com/$REPO/releases/latest/download"
  fi
  base="${PANE_DOWNLOAD_BASE:-$base}"

  install_dir="${PANE_INSTALL_DIR:-$(default_install_dir)}"

  tmp=$(mktemp -d)
  trap 'rm -rf "$tmp"' EXIT

  say "Downloading $NAME for $target..."
  download "$base/$archive" "$tmp/$archive"
  download "$base/SHA256SUMS" "$tmp/SHA256SUMS"

  expected=$(grep " $archive\$" "$tmp/SHA256SUMS" | cut -d ' ' -f 1)
  [ -n "$expected" ] || fail "the release has no checksum for $archive."
  [ "$(sha256_of "$tmp/$archive")" = "$expected" ] ||
    fail "the download is damaged or was changed (checksum mismatch). Nothing was installed."

  tar -xzf "$tmp/$archive" -C "$tmp"
  [ -f "$tmp/$NAME" ] || fail "the archive does not contain $NAME."

  mkdir -p "$install_dir" 2>/dev/null || fail "cannot create $install_dir. Set PANE_INSTALL_DIR to a folder you can write to."
  [ -w "$install_dir" ] || fail "cannot write to $install_dir. Set PANE_INSTALL_DIR to a folder you can write to."
  chmod 755 "$tmp/$NAME"
  mv -f "$tmp/$NAME" "$install_dir/$NAME"

  installed_version=$("$install_dir/$NAME" --version) || fail "$NAME was installed but does not start on this machine."
  say "Installed $NAME $installed_version to $install_dir/$NAME"

  case ":$PATH:" in
    *":$install_dir:"*)
      found=$(command -v "$NAME" || true)
      if [ "$found" != "$install_dir/$NAME" ]; then
        say ""
        say "Note: another $NAME at $found comes first on your PATH."
      fi
      ;;
    *)
      say ""
      say "$install_dir is not on your PATH yet. Add it with:"
      say ""
      say "  echo 'export PATH=\"$install_dir:\$PATH\"' >> $(shell_profile)"
      say ""
      say "then open a new terminal."
      ;;
  esac

  say ""
  say "Run \"$NAME\" in any folder to open it, or \"$NAME --help\" for options."
}

main "$@"
