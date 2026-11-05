// @ts-nocheck -- GPUI mod: theme() colors are typed as hex only, so the generated d.ts flags every theme pass. herdr-app check is the gate.
// New workspace: pick a folder, and the new space's terminal starts there.
//
// The list is one `sh` call per folder. It drops dot-folders and folders the
// person cannot write to, because a workspace you cannot write to is not a
// workspace. There is no polling and no timer: the dialog costs nothing while
// it is closed.

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { closeOverlay, exec, home, props, run, setShared, settings, shared, spaces, theme, window } from "herdr";
import { crumbs, nameOf, normalize, parentOf, parseListing, places, recents, remember } from "./logic.js";

const LAST = "new-workspace.last";
const RECENTS = "new-workspace.recents";
const ROW = 30;

// `$1` is the folder. NUL keeps names with spaces or newlines whole; the first
// record says whether the folder itself takes new files.
const LIST = `
cd "$1" || exit 3
if [ -w . ]; then printf 'W\\0'; else printf 'R\\0'; fi
for entry in */; do
  [ -d "$entry" ] || continue
  name=\${entry%/}
  [ -w "$name" ] || continue
  printf '%s\\0' "$name"
done
`;

export default class NewWorkspace extends View {
  init(_props, cx) {
    this.handle = cx.focus_handle();
    this.handle.focus();
    this.entries = [];
    this.at = 0;
    this.writable = false;
    this.loading = true;
    this.note = null;
    this.scroll = 0;
    this.viewH = 0;
    this.alive = true;
    this.seq = 0;
    const here = spaces().find((s) => s.active && !s.machine)?.folder;
    const start = normalize(shared(LAST) || here || home(), home());
    this.cwd = start;
    this.load(start, cx, start !== home());
  }

  close() {
    this.alive = false;
    const overlay = props()?.overlay;
    if (overlay) closeOverlay(overlay);
  }

  // A cx lives for one dispatch only (gpui-kit Context docs). The sync part
  // runs on the caller's live cx; the part after `await` runs on spawn's
  // AsyncContext. Handing a render's cx to a click handler throws
  // stale-context and the click silently does nothing.
  load(path, cx, retry = false) {
    const seq = ++this.seq;
    this.loading = true;
    this.note = null;
    cx.notify();
    cx.spawn(async (cx) => {
      let result;
      try {
        result = await exec("/bin/sh", ["-c", LIST, "sh", path]);
      } catch {
        result = { code: 1, stdout: "" };
      }
      if (!this.alive || seq !== this.seq) return;
      if (result.code !== 0) {
        if (retry) return this.load(home(), cx);
        this.loading = false;
        this.note = "Cannot open that folder.";
        cx.notify();
        return;
      }
      const listing = parseListing(result.stdout);
      this.writable = listing.writable;
      this.entries = listing.entries;
      this.cwd = path;
      this.at = 0;
      this.loading = false;
      this.scroll = 0;
      cx.notify();
    });
  }

  enter(name, cx) {
    const base = this.cwd === "/" ? "" : this.cwd;
    this.load(base + "/" + name, cx);
  }

  up(cx) {
    const parent = parentOf(this.cwd);
    if (parent) this.load(parent, cx);
  }

  open() {
    if (!this.writable || this.loading) return;
    const folder = this.cwd;
    const list = remember(folder, shared(RECENTS));
    setShared(RECENTS, list);
    setShared(LAST, folder);
    this.close();
    // The list is this computer's; do not inherit a remote active space.
    run("space.new", { folder, machine: "" });
  }

  keys(event, cx) {
    const key = event.key;
    const mod = event.modifiers.platform;
    if (key === "escape") return this.close();
    if (key === "arrowdown") {
      if (this.entries.length) {
        this.at = (this.at + 1) % this.entries.length;
      }
    } else if (key === "arrowup" && mod) {
      this.up(cx);
    } else if (key === "arrowup") {
      if (this.entries.length) {
        this.at = (this.at + this.entries.length - 1) % this.entries.length;
      }
    } else if (key === "backspace") {
      this.up(cx);
    } else if (key === "enter") {
      if (mod || !this.entries[this.at]) this.open();
      else this.enter(this.entries[this.at], cx);
    } else {
      return;
    }
    cx.stop_propagation();
    cx.notify();
  }

  keycap(t, label) {
    return div().h(20).px(6).flex().items_center().justify_center().rounded(5)
      .border(1).border_color(t.border).bg(t.raised)
      .text_size(9.5).text_color(t.dim).child(label);
  }

  section(t, label) {
    return div().px(9).pt(2).pb(4).text_size(9).font_semibold().text_color(t.dim).child(label);
  }

  sideRow(t, id, target, icon, label, current) {
    const on = current === target;
    return h_flex().id(id).h(27).flex_none().px(8).gap(8).items_center().rounded(6)
      .when(on, (el) => el.bg(t.selected))
      .hover((s) => s.bg(t.hover))
      .on_click((_e, cx) => this.load(target, cx))
      .child(svg(icon).size(12).flex_none().text_color(on ? t.foreground : t.muted))
      .child(div().flex_1().min_w(0).truncate().text_size(11.5).text_color(on ? t.foreground : t.muted).child(label));
  }

  sidebar(t) {
    const current = this.cwd;
    const rows = [this.section(t, "PLACES")];
    places(home()).forEach((p, i) => rows.push(this.sideRow(t, `nw-place-${i}`, p.path, p.icon, p.name, current)));
    rows.push(div().h(1).mx(8).my(6).flex_none().bg(t.border));
    rows.push(this.section(t, "RECENT"));
    const recent = recents(shared(RECENTS), spaces(), home()).filter((p) => p !== current);
    if (recent.length === 0) {
      rows.push(div().px(9).py(3).text_size(10.5).text_color(t.dim).child("Nothing yet"));
    }
    recent.forEach((p, i) => rows.push(this.sideRow(t, `nw-recent-${i}`, p, "mods/workspace-chrome/clock.svg", nameOf(p), current)));
    return v_flex().w(152).flex_none().h_full().bg(t.chrome).pt(8).pb(8)
      .child(v_flex().flex_1().min_h(0).children(rows))
      .child(div().px(10).pt(7).border_t(1).border_color(t.border).text_size(9).line_height("13px").text_color(t.dim)
        .child("Hidden and read-only folders stay out."));
  }

  button(t, id, label, primary, onclick, enabled = true) {
    const base = h_flex().id(id).h(30).px(14).flex_none().items_center().justify_center().rounded(7).text_size(11.5);
    if (!enabled) return base.bg(t.raised).text_color(t.dim).child(label);
    if (primary) {
      return base.bg(t.accent).text_color(t.accent_foreground ?? "#ffffff").cursor_pointer()
        .on_click(onclick).child(label);
    }
    return base.border(1).border_color(t.border).text_color(t.muted).cursor_pointer()
      .hover((s) => s.bg(t.hover).text_color(t.foreground)).on_click(onclick).child(label);
  }

  row(t, index, name) {
    const on = index === this.at;
    return h_flex().id(`nw-row-${name}`).h(ROW).px(8).gap(9).items_center().rounded(6)
      .when(on, (el) => el.bg(t.selected))
      .hover((s) => s.bg(t.hover))
      .on_click((_e, cx) => this.enter(name, cx))
      .child(svg("mods/files/folder.svg").size(14).flex_none().text_color(on ? t.foreground : t.muted))
      .child(div().flex_1().min_w(0).truncate().text_size(12.5).text_color(t.foreground).child(name));
  }

  listView(t) {
    if (this.loading) return this.empty(t, "Reading…", null);
    if (this.entries.length === 0) {
      return this.writable
        ? this.empty(t, "No folders here", "Choose this folder, or go up.")
        : this.empty(t, "This folder is read-only", "Pick one you can write to.");
    }
    const viewH = this.viewH || 294;
    const total = this.entries.length * ROW;
    const maxScroll = Math.max(0, total - viewH);
    this.scroll = Math.max(0, Math.min(this.scroll, maxScroll));
    const top = this.at * ROW;
    if (top < this.scroll) this.scroll = top;
    else if (top + ROW > this.scroll + viewH) this.scroll = top + ROW - viewH;
    const thumb = Math.max(24, (viewH * viewH) / total);
    const thumbTop = maxScroll > 0 ? (viewH - thumb) * (this.scroll / maxScroll) : 0;
    return v_flex().id("nw-list").relative().flex_1().min_h(0).overflow_hidden()
      .on_size_change((size, cx) => {
        const h = size.height / (settings().zoom || 1);
        if (Math.abs(this.viewH - h) > 1) {
          this.viewH = h;
          cx.notify();
        }
      })
      .on_scroll_wheel((event, cx) => {
        this.scroll = Math.max(0, Math.min(this.scroll - event.delta.y, maxScroll));
        // Render keeps `at` visible, so the wheel moves it into the new
        // window too; left behind, the next frame scrolls back to it.
        const first = Math.ceil(this.scroll / ROW);
        const last = Math.min(this.entries.length - 1, Math.ceil((this.scroll + viewH) / ROW) - 1);
        this.at = Math.min(Math.max(this.at, first), Math.max(first, last));
        cx.notify();
      })
      .children(this.entries.map((name, i) =>
        div().absolute().left(0).right(0).top(i * ROW - this.scroll).h(ROW).child(this.row(t, i, name))))
      .when(maxScroll > 0, (el) => el.child(div().absolute().right(3).top(thumbTop).w(3).h(thumb).rounded(2).bg(t.border)));
  }

  empty(t, title, detail) {
    return v_flex().size_full().items_center().justify_center().gap(4)
      .child(div().text_size(11.5).text_color(t.muted).child(title))
      .when(Boolean(detail), (el) => el.child(div().text_size(10).text_color(t.dim).child(detail)));
  }

  render() {
    const t = theme();
    const mac = window()?.platform === "macos";
    const path = this.cwd ?? home();
    const hint = this.note ?? (this.writable ? `${mac ? "⌘" : "Ctrl+"}↵ opens this folder` : "Choose a folder you can write to");
    const header = h_flex().h(54).flex_none().px(16).items_center().border_b(1).border_color(t.border)
      .child(v_flex().flex_1().gap(2)
        .child(div().text_size(13.5).font_semibold().text_color(t.foreground).child("New workspace"))
        .child(div().text_size(10.5).text_color(t.dim).child("Pick a folder. The new space's terminal starts there.")))
      .child(this.keycap(t, "Esc"));
    const toolbar = h_flex().h(38).flex_none().px(8).gap(2).items_center().border_b(1).border_color(t.border)
      .child(h_flex().id("nw-up").size(26).flex_none().items_center().justify_center().rounded(6)
        .text_size(13).text_color(t.muted).cursor_pointer()
        .hover((s) => s.bg(t.hover).text_color(t.foreground))
        .on_click((_e, cx) => this.up(cx)).child("↑"))
      .child(h_flex().flex_1().min_w(0).gap(1).items_center().overflow_hidden()
        .children(crumbs(path, home()).flatMap((c, i, all) => [
          i && all[i - 1].name !== "/" ? div().flex_none().text_size(10).text_color(t.dim).child("/") : null,
          div().id(`nw-crumb-${i}`).px(5).py(3).rounded(4).flex_none().text_size(11)
            .text_color(c.path === path ? t.foreground : t.muted)
            .when(c.path !== path, (el) => el.cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground)))
            .on_click((_e, cx) => this.load(c.path, cx))
            .child(c.name),
        ]).filter(Boolean)));
    const body = h_flex().flex_1().min_h(0)
      .child(this.sidebar(t))
      .child(div().w(1).flex_none().h_full().bg(t.border))
      .child(v_flex().flex_1().min_w(0).min_h(0).h_full().p(6).child(this.listView(t)));
    const footer = h_flex().h(52).flex_none().px(14).gap(8).items_center().border_t(1).border_color(t.border)
      .child(div().flex_1().text_size(10).text_color(this.note ? t.blocked : t.dim).child(hint))
      .child(this.button(t, "nw-cancel", "Cancel", false, () => this.close()))
      .child(this.button(t, "nw-open", "Open workspace", true, () => this.open(), this.writable && !this.loading));
    return v_flex().id("new-workspace").size_full().bg(t.popover).text_size(12.5)
      .track_focus(this.handle)
      .on_key_down((event, cx) => this.keys(event, cx))
      .child(header)
      .child(toolbar)
      .child(body)
      .child(footer);
  }
}
