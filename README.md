# pane

A small local code viewer and editor. Run `pane` in a folder and it opens in your browser with
a file tree, tabs, search and the Monaco editor (the editor inside VS Code). Markdown, SVG,
JSON, CSV and images get a preview.

Everything stays on your machine: pane listens on `127.0.0.1` only.

## Install

On macOS or Linux:

```sh
curl -fsSL https://raw.githubusercontent.com/nikhilnigamnik/pane/main/install.sh | sh
```

This puts a single `pane` file in `~/.local/bin`. Nothing else is needed: no Node, no npm.

To pick a version or another folder:

```sh
curl -fsSL https://raw.githubusercontent.com/nikhilnigamnik/pane/main/install.sh | PANE_VERSION=0.1.0 sh
curl -fsSL https://raw.githubusercontent.com/nikhilnigamnik/pane/main/install.sh | PANE_INSTALL_DIR=/usr/local/bin sh
```

Run the same command again to update. To uninstall, delete the file: `rm ~/.local/bin/pane`.

## Use

```sh
pane                  # open the current folder
pane ~/code/my-app    # open another folder
pane notes.md         # open a file, with its folder in the sidebar
pane -p 8000          # use another port (default 7878)
pane --no-open        # print the address instead of opening the browser
```

Press Ctrl+C in the terminal to stop it. Cmd+Shift+P (Ctrl+Shift+P on Linux) lists every
command and its shortcut.

## Develop

See [AGENTS.md](AGENTS.md) for the layout, commands and conventions.

To publish a release, set the new `version` in `package.json`, commit, then push a tag with the
same version:

```sh
git tag v0.2.0
git push origin v0.2.0
```

The release workflow builds a binary for each platform, installs and tests each one on that
platform, and publishes them as a GitHub release, which is where `install.sh` downloads from.
