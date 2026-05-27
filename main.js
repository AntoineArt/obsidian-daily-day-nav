"use strict";

const { Plugin, Notice, normalizePath } = require("obsidian");

module.exports = class DailyPreviousDayPlugin extends Plugin {
  onload() {
    this.addCommand({
      id: "open-previous-daily",
      name: "Open previous daily note",
      callback: () => {
        void this.openDailyForOffset(-1);
      },
    });

    this.addCommand({
      id: "open-next-daily",
      name: "Open next daily note",
      callback: () => {
        void this.openDailyForOffset(1);
      },
    });
  }

  getDailyNotesCore() {
    return this.app.internalPlugins.getPluginById("daily-notes");
  }

  getDailyNotesSettings() {
    const options = this.getDailyNotesCore()?.instance?.options ?? {};
    return {
      folder: options.folder || "",
      format: options.format || "YYYY-MM-DD",
    };
  }

  getReferenceDate() {
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      return window.moment().startOf("day");
    }

    const { folder, format } = this.getDailyNotesSettings();
    if (!folder || !file.path.startsWith(normalizePath(folder) + "/")) {
      return window.moment().startOf("day");
    }

    const parsed = window.moment(file.basename, format, true);
    return parsed.isValid() ? parsed.startOf("day") : window.moment().startOf("day");
  }

  async openDailyForOffset(dayOffset) {
    const core = this.getDailyNotesCore();
    if (!core?.enabled) {
      new Notice("Enable the daily notes core plugin first.");
      return;
    }

    const { folder, format } = this.getDailyNotesSettings();
    if (!folder) {
      new Notice("Configure a daily notes folder in Obsidian settings first.");
      return;
    }

    const target = this.getReferenceDate().add(dayOffset, "day");
    const path = normalizePath(`${folder}/${target.format(format)}.md`);
    const existing = this.app.vault.getAbstractFileByPath(path);
    const file = existing ?? (await core.instance.createDailyNote(target));

    if (file) {
      await this.app.workspace.getLeaf(false).openFile(file);
    }
  }
};
