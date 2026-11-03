# Herdr Mods

Community mods and modding notes for the **Herdr desktop app** — the native macOS, Linux and Windows app for terminals and coding agents.

> Unofficial community project. Herdr is made by [herdr.dev](https://herdr.dev); this repository is not affiliated with the Herdr team.

Herdr's entire interface is built from plain files in `~/.config/herdr-app`. Layouts, keys, themes, panels and bars are all editable, and **mods** are the small JavaScript programs behind them. A mod can add a panel, a tab bar, an agent board, a status widget, a popup, a menu, or anything else the app can draw.

- Mods directory on herdr.dev: <https://herdr.dev/mods/>
- Modding guide for agents: <https://github.com/herdrdev/herdr-app/blob/master/defaults/AGENTS.md>
- Herdr app source: <https://github.com/herdrdev/herdr-app>

---

## Quick start

Install the Herdr desktop app:

```sh
curl -fsSL https://releases.herdr.dev/app/install.sh | sh
```

Start Herdr, then point your coding agent at the guide Herdr writes for it:

```text
Read ~/.config/herdr-app/AGENTS.md
```

Ask for a mod in plain language:

```text
Put a timer on each tab: how long its agent has been working.
```

Or install a published mod by URL:

```text
Read ~/.config/herdr-app/AGENTS.md, then add this mod: herdr.dev/mods/herdrdev/tmux-prefix
```

Your agent reads every file first, copies the mod into `~/.config/herdr-app/mods/`, merges any keys, and runs `herdr-app check`.

---

## What a mod is

A mod is a folder under `~/.config/herdr-app/mods/` containing at least:

```text
~/.config/herdr-app/
├── AGENTS.md          # the guide Herdr writes for your agent
├── settings.json      # zoom, sounds, fonts, theme, telemetry
├── keys.json          # every key binding
├── layouts/           # one JSON file per window layout
├── themes/            # optional custom themes
└── mods/
    └── my-mod/
        ├── main.js    # required: the mod itself
        ├── mod.json   # where and how it first appears
        ├── ui.js      # optional extra modules
        └── icon.svg   # optional assets
```

Key properties:

- **Native, not a web page.** Mods describe GPUI elements (`div()`, `h_flex()`, `v_flex()`) in JavaScript. There is no DOM, HTML, CSS, web view or Node API.
- **Live reload.** Saving a file reloads every copy of the mod in place. A broken save keeps the last good version running.
- **Trusted code.** Mods can run programs, call `hc`, read files, use the network and change the app. Read a mod before installing it.
- **Per-copy state.** A mod can be shown in several places at once; each copy has its own lifecycle and `localStorage`.
- **Theme-aware.** Use `theme()` colors so the mod follows the person's light or dark theme.

Mods are **not** reviewed by Herdr. Community preview images are screened, but the code is not audited.

---

## `mod.json`

`mod.json` tells Herdr where a mod appears the first time it sees the folder. After that, layouts decide.

```json
{
  "place": "right",
  "size": 320,
  "title": "My mod"
}
```

Common fields:

| Field | Meaning |
| --- | --- |
| `place` | First dock position: `"right"`, `"left"`, `"top"`, `"bottom"` or `"none"`. Use `"none"` for mods opened by a key, menu or layout only. |
| `size` | Size in px for a docked mod. |
| `title` | Human-readable name shown by the app and examples. |
| `focusable` | `true` lets `pane.go` give a visible copy the keyboard; the mod receives `"focus"` from `nextCommand()`. |
| `overlay` | Defaults for a mod opened as an overlay, for example `{ "kind": "popup", "at": "top", "offset": 64, "width": 520, "height": 420 }`. |

A popup-only mod uses `"place": "none"` and an overlay manifest, so it needs no layout change and no `layouts/` folder. The published [Tmux prefix](https://herdr.dev/mods/herdrdev/tmux-prefix/) mod is a complete example.

Herdr owns the schema and updates it between versions. The installed `herdr.d.ts`, `gpui-kit.d.ts` and `AGENTS.md` are the source of truth for the version you run.

---

## A minimal mod

`mods/hello/main.js`:

```js
import { View, div } from "gpui-kit";
import { v_flex } from "gpui-base";
import { run, spaces, theme } from "herdr";

export default class Hello extends View {
  render() {
    const t = theme();
    return v_flex()
      .size_full()
      .p(12)
      .gap(6)
      .bg(t.surface)
      .text_color(t.foreground)
      .children(
        spaces().map((space) =>
          div()
            .id(`space-${space.id}`)
            .p(8)
            .rounded(4)
            .hover((el) => el.bg(t.hover))
            .on_click(() => run("space.select", { id: space.id }))
            .child(space.name),
        ),
      );
  }
}
```

`mods/hello/mod.json`:

```json
{ "place": "right", "size": 240, "title": "Hello" }
```

Check it:

```sh
herdr-app check ~/.config/herdr-app/mods/hello
```

### Lifecycle rules

- `main.js` default-exports a class extending `View`.
- `init(props, cx)` runs once. `render(cx)` describes the UI and runs again after `cx.notify()` or when live Herdr data changes.
- Optional `async close(cx)` runs when the mod's pane, tab, slot or overlay goes away, and on quit. Cleanup has at most 250 ms.
- **Never keep a `cx` and use it later.** Every callback gets its own: `on_click((event, cx) => …)`, `cx.spawn(async (cx) => …)`, `cx.timer.every(ms, (cx) => …)`.
- No `setTimeout`, `setInterval` or top-level `await`. Use `cx.timer` and `cx.spawn`.
- Do not poll data that Herdr already exposes (`spaces()`, `agents()`, `terminals()`, focus, theme); renders follow it automatically.
- Keep one mod per idea. Never edit Herdr's shipped mods; clone them instead.
- Animate natively with `.frames([...], ms)`, `.spin(ms)`, `.loop(...)` and `.transition(...)`. Timer-driven redraws cost battery.

---

## The `herdr` API at a glance

The full surface is in `~/.config/herdr-app/herdr.d.ts`.

### Live data

| Function | Gives you |
| --- | --- |
| `spaces()` | Spaces, their tabs, status, name, folder, machine, branch. |
| `machines()` | This computer and SSH machines; `null` name means local. |
| `agents()` | Agent terminals with status, app, space, tab, pinned and focused. |
| `terminals()` | Every terminal known to herdr-core, including sub-agents. |
| `panes()` | Terminal panes and mod panes in the current layout. |
| `focused()` | The focused space, tab, pane, terminal and agent. |
| `layout()` | The current layout tree. |
| `theme()` | Every theme color by name (`background`, `surface`, `foreground`, `muted`, `accent`, `working`, `blocked`, `done`, `idle`, …). |
| `settings()` | The person's settings, including `dark` for the current appearance. |
| `keys()`, `commands()`, `layouts()` | Bindings, app commands with arguments, and layout names. |
| `props()`, `placement()` | Props passed to this copy; floating placement when it floats. |

### Actions

```js
run("tab.new", { name: "fix login" });
run("pane.split", { direction: "right" });
run("space.select", { id: space.id });
run("terminal.show", { terminal: "t7" });
```

`run(command, args)` is the only way to change the app. The same command list powers keys, clicks and menus. See every command and its arguments with:

```sh
herdr-app commands
```

### Overlays and notifications

```js
import { closeOverlay, openOverlay, notify, props } from "herdr";

const id = openOverlay({
  mod: "my-mod",
  kind: "popup", // "dialog" | "popup" | "window"
  width: 480,
  height: 320,
  at: "top",
  props: { hello: "world" },
});

closeOverlay(props().overlay);

notify({ title: "Build done", body: "All tests passed", level: "info" });
```

- `dialog` / `popup` close on Escape.
- `window` stays open over the layout, can be dragged, remembers its spot with `key`, and can be kept across restarts with `keep: true`.
- `frame: "none"` lets the mod draw its own frame.

### Files, programs and machines

```js
import { exec, hc, readTextFile, writeTextFile, watchFolder, pickFolder } from "herdr";

const result = await exec("git", ["status", "--short"], { cwd: folder, on: machine });
const text = await readTextFile(path);
await writeTextFile(path, text);
const changed = await watchFolder(folder);
const picked = await pickFolder({ prompt: "Choose a folder" });
await hc(["read", "t3", "--lines", "50"]);
```

- `exec` runs in the person's real environment. Pass `on: space.machine` to run on another machine.
- `hc` drives herdr-core: run terminals, read screens, send text, wait for agents.
- `watchFolder` is local-only; poll a remote folder with a timer.

### Shared state

```js
import { shared, setShared } from "herdr";

setShared("my-mod.enabled", true); // every mod sees it and re-renders
const enabled = shared("my-mod.enabled");
```

Use `localStorage` for state that belongs to one copy of a mod.

---

## Keys: `keys.json`

A mod can ship a `keys.json` snippet. **Merge it** into the person's existing file; never replace the file.

```json
{
  "global": { "ctrl-shift-m": "mod.open:my-mod" },
  "terminal": { "ctrl-shift-m": "mod.open:my-mod" },
  "mod:my-mod": { "ctrl-s": "my-mod.save" }
}
```

Sections:

| Section | Active when |
| --- | --- |
| `global` | Anywhere in the app. |
| `layout:<name>` | A specific layout is shown. |
| `terminal` | A terminal has keyboard focus. |
| `mod:<name>` | That mod's copy has focus. |

More specific sections win: `terminal` beats `layout:<name>` and `global`; `layout:<name>` beats `global`.

An action can be:

- an app command: `"tab.new"` or `"pane.split:right"`
- text sent to the terminal: `"send:\u001bb"`
- a command delivered to a mod: `"my-mod.save"` (received through `nextCommand()`)
- `"terminal"` to let the program receive the key

Avoid stealing keys terminal programs rely on (`ctrl+c`, `ctrl+d`, `ctrl+l`, `ctrl+r`, `ctrl+w`, `ctrl+a`, `ctrl+e`, `ctrl+u`, `ctrl+k`, `ctrl+z`, `ctrl+[`) unless the person asks. On Windows, `ctrl+alt` is AltGr; on macOS, Option may type characters.

---

## Installing a mod manually

1. Read the mod's `RECIPE.md` and every file. Check whether it reaches the network, runs programs (`exec`, `hc`) or reads files outside its folder.
2. Copy its `mods/<name>/` folder to `~/.config/herdr-app/mods/`. Never overwrite an existing mod; rename on a clash.
3. If it has `keys.json`, merge its sections into `~/.config/herdr-app/keys.json`. Ask before replacing a key already in use.
4. Check it:

   ```sh
   herdr-app check ~/.config/herdr-app/mods/<name>
   ```

5. Try it in the app. Use `herdr-app status` for errors and `herdr-app shot` for a PNG of the last frame.

Files apply live. If a file is invalid, Herdr keeps the last good version and writes the reason to `<name>.error` (`layout.error`, `keys.error`, `settings.error`, `programs.error`). The escape hatch `ctrl-alt-shift-escape` always returns to the default `main` layout.

---

## Developing a mod

Typical loop:

```sh
# Load once and report the exact error
herdr-app check ~/.config/herdr-app/mods/my-mod

# See file and mod errors, layout, focus, overlays, zoom
herdr-app status

# Save the last rendered frame as a PNG
herdr-app shot /tmp/my-mod.png

# Inspect every app command and its arguments
herdr-app commands

# Run a command from a shell
herdr-app do tab.new --name "fix login" --argv '["claude"]'
```

Herdr reloads mods on save. A reload stops the old build's tasks and timers; a loop ends at its next `cx` use. Keep side effects out of module top-level code.

Useful references in `~/.config/herdr-app`:

- `AGENTS.md` — the complete agent-facing guide, regenerated by Herdr
- `herdr.d.ts` — app data, commands and the `herdr` module
- `gpui-kit.d.ts` — elements, builders, events and native animation
- `mods/` — Herdr's own mods (`spaces`, `agents`, `tabs`, `menu`, `pane`, `worktree`, …) are readable examples

To customize a shipped mod, clone it instead of editing it:

```sh
herdr-app do mod.clone '{"name":"files","as":"my-files"}'
```

---

## Publishing a mod

Herdr lists community mods at <https://herdr.dev/mods/>. Publishing takes three steps and no sign-up.

### 1. Write a `RECIPE.md`

A recipe is a brief another agent can use to rebuild the mod from an empty folder. Herdr's format:

1. `# Name`, one paragraph of what the person sees, and `![Name](preview.png)`.
2. **What you see** — regions, sizes, colors, type, what each part shows.
3. **How it behaves** — every agent status, click, key, hover and movement.
4. **Built from** — layout nodes, mods and props, shipped mods used, `herdr` functions and commands, programs run, art.
5. **Watch out** — limits, gotchas, controls that do nothing yet, assumptions.
6. **Done when** — checks that prove the build works.

Ask your agent to generate it:

```text
Read ~/.config/herdr-app/AGENTS.md, then write a RECIPE.md for my <name> mod the way it describes: a brief another agent could build it from with an empty folder. Put the mods/<name>/ folder, any keys.json snippet, the recipe and a screenshot named preview.png in one folder, without a layouts/ folder, push it to a public GitHub repo and add the topic herdr-mod.
```

### 2. Push a public GitHub repository

One folder per mod:

```text
my-mod/
├── RECIPE.md
├── preview.png
├── keys.json          # optional
└── mods/
    └── my-mod/
        ├── main.js
        ├── mod.json
        └── ...        # extra modules, icons, fonts
```

- No `layouts/` folder. A mod is a piece added to someone's existing layout.
- One repository can hold several mods, one folder each.
- Add the repository topic **`herdr-mod`**.

### 3. Wait for it to appear

Community mods show up on <https://herdr.dev/mods/> within the hour. Herdr does not review the code; preview images are screened.

---

## This repository

This repository follows the same publishing layout: **one top-level folder per mod**.

```text
herdr-mods/
├── README.md
└── <mod-name>/
    ├── RECIPE.md
    ├── preview.png
    ├── keys.json          # optional
    └── mods/
        └── <mod-name>/
            ├── main.js
            ├── mod.json
            └── ...
```

### Adding a mod here

- [ ] Folder name is lowercase and hyphenated (`agent-timer`, not `AgentTimer`).
- [ ] `mods/<name>/main.js` default-exports a `View` subclass.
- [ ] `mods/<name>/mod.json` has a valid `place`; use `"none"` for popup-only mods.
- [ ] `herdr-app check mods/<name>` passes with the Herdr version you target.
- [ ] `RECIPE.md` follows the six-section format and matches the real files.
- [ ] `preview.png` is a real screenshot of the mod.
- [ ] Any `keys.json` is a mergeable snippet, not a full replacement.
- [ ] No `layouts/` folder, no secrets, no machine-specific paths.
- [ ] The README for the mod says if it runs programs, uses the network or reads files outside its folder.

### Mods in this repository

_None yet. Add the first one using the layout above._

---

## Security

Mods are **trusted code**. They run inside Herdr with the person's permissions and can:

- run programs and shell commands (`exec`, `hc`)
- read files in the home folder
- write under `~/.config/herdr-app`
- fetch URLs and reach the network
- rebind keys, open overlays and change the interface

Herdr does not review community mods. Before installing one, read `RECIPE.md` and every file, and check what it executes and which keys it changes. Install only from sources you trust.

---

## Resources

| Resource | Link |
| --- | --- |
| Herdr desktop app | <https://herdr.dev> |
| Community mods | <https://herdr.dev/mods/> |
| Layouts | <https://herdr.dev/layouts/> |
| Guide | <https://herdr.dev/guide/> |
| Agent-facing guide (`AGENTS.md`) | <https://github.com/herdrdev/herdr-app/blob/master/defaults/AGENTS.md> |
| Herdr app source | <https://github.com/herdrdev/herdr-app> |
| herdr-core source | <https://github.com/herdrdev/herdr-core> |
| Example mods and layouts | <https://github.com/herdrdev/herdr-layout-examples> |
| GPUI Kit | <https://gpui-kit.com> |
| Discord | <https://discord.gg/PsgRfzmUDg> |

---

## License

Herdr itself is open source under Apache 2.0. Each mod in this repository should declare its own license in its folder.
