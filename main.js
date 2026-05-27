"use strict";

const {
  Plugin,
  Modal,
  Notice,
  Setting,
  PluginSettingTab,
  normalizePath,
} = require("obsidian");

const DEFAULT_SETTINGS = {
  gapScanDays: 90,
};

class DailyGapsPlugin extends Plugin {
  async onload() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

    this.addCommand({
      id: "open-daily-for-date",
      name: "Open daily note for date",
      callback: () => this.promptOpenDailyForDate(),
    });

    this.addCommand({
      id: "fill-gaps-to-next",
      name: "Fill missing daily notes until next entry",
      callback: () => this.fillGapsToward("next"),
    });

    this.addCommand({
      id: "fill-gaps-to-previous",
      name: "Fill missing daily notes since previous entry",
      callback: () => this.fillGapsToward("previous"),
    });

    this.addCommand({
      id: "fill-gaps-in-range",
      name: "Fill missing daily notes in date range",
      callback: () => this.promptFillRange(),
    });

    this.addCommand({
      id: "show-missing-daily-notes",
      name: "Show missing daily notes",
      callback: () => this.showMissingDailyNotes(),
    });

    this.addCommand({
      id: "open-next-existing-daily",
      name: "Open next existing daily note",
      callback: () => this.openAdjacentExisting("next"),
    });

    this.addCommand({
      id: "open-previous-existing-daily",
      name: "Open previous existing daily note",
      callback: () => this.openAdjacentExisting("previous"),
    });

    this.addSettingTab(new DailyGapsSettingTab(this.app, this));
  }

  async onunload() {}

  getDailyNotesCore() {
    return this.app.internalPlugins.getPluginById("daily-notes");
  }

  getDailyNotesSettings() {
    const core = this.getDailyNotesCore();
    const options = core?.instance?.options ?? {};
    return {
      folder: options.folder || "",
      format: options.format || "YYYY-MM-DD",
      template: options.template || "",
    };
  }

  ensureDailyNotesEnabled() {
    const core = this.getDailyNotesCore();
    if (!core?.enabled) {
      new Notice("Enable the daily notes core plugin first.");
      return false;
    }
    const { folder } = this.getDailyNotesSettings();
    if (!folder) {
      new Notice("Configure a daily notes folder in Obsidian settings first.");
      return false;
    }
    return true;
  }

  getMomentFromFile(file) {
    if (!file) return null;
    const { folder, format } = this.getDailyNotesSettings();
    if (!file.path.startsWith(normalizePath(folder) + "/")) return null;
    const parsed = window.moment(file.basename, format, true);
    return parsed.isValid() ? parsed.startOf("day") : null;
  }

  async listDailyNoteEntries() {
    const { folder, format } = this.getDailyNotesSettings();
    const prefix = normalizePath(folder) + "/";
    const entries = [];

    for (const file of this.app.vault.getMarkdownFiles()) {
      if (!file.path.startsWith(prefix)) continue;
      const parsed = window.moment(file.basename, format, true);
      if (!parsed.isValid()) continue;
      entries.push({
        date: parsed.startOf("day"),
        file,
      });
    }

    entries.sort((a, b) => a.date.valueOf() - b.date.valueOf());
    return entries;
  }

  buildExistingDateSet(entries) {
    const set = new Set();
    for (const entry of entries) {
      set.add(entry.date.format("YYYY-MM-DD"));
    }
    return set;
  }

  getMissingDatesBetween(start, end, existingSet) {
    const missing = [];
    const cursor = start.clone().add(1, "day");
    while (cursor.isBefore(end, "day")) {
      const key = cursor.format("YYYY-MM-DD");
      if (!existingSet.has(key)) {
        missing.push(cursor.clone());
      }
      cursor.add(1, "day");
    }
    return missing;
  }

  async createDailyNote(date) {
    const core = this.getDailyNotesCore();
    return core.instance.createDailyNote(date.clone());
  }

  async openDailyNote(date) {
    const entries = await this.listDailyNoteEntries();
    const key = date.format("YYYY-MM-DD");
    const existing = entries.find((entry) => entry.date.format("YYYY-MM-DD") === key);
    if (existing) {
      await this.app.workspace.getLeaf(false).openFile(existing.file);
      return existing.file;
    }
    const created = await this.createDailyNote(date);
    if (created) {
      await this.app.workspace.getLeaf(false).openFile(created);
    }
    return created;
  }

  getReferenceDate() {
    const activeFile = this.app.workspace.getActiveFile();
    const fromActive = this.getMomentFromFile(activeFile);
    if (fromActive) return fromActive;
    return window.moment().startOf("day");
  }

  async fillMissingDates(dates) {
    if (dates.length === 0) {
      new Notice("No missing daily notes to create.");
      return [];
    }

    const created = [];
    for (const date of dates) {
      const file = await this.createDailyNote(date);
      if (file) created.push(file);
    }

    if (created.length > 0) {
      await this.app.workspace.getLeaf(false).openFile(created[0]);
      new Notice(`Created ${created.length} missing daily note${created.length > 1 ? "s" : ""}.`);
    }

    return created;
  }

  async fillGapsToward(direction) {
    if (!this.ensureDailyNotesEnabled()) return;

    const reference = this.getReferenceDate();
    const entries = await this.listDailyNoteEntries();
    if (entries.length === 0) {
      new Notice("No daily notes found yet.");
      return;
    }

    const existingSet = this.buildExistingDateSet(entries);
    const index = entries.findIndex(
      (entry) => entry.date.format("YYYY-MM-DD") === reference.format("YYYY-MM-DD")
    );

    if (direction === "next") {
      const anchor = index >= 0 ? entries[index] : { date: reference };
      const next = entries.find((entry) => entry.date.isAfter(anchor.date, "day"));
      if (!next) {
        new Notice("No later daily note found to fill toward.");
        return;
      }
      const missing = this.getMissingDatesBetween(anchor.date, next.date, existingSet);
      await this.fillMissingDates(missing);
      return;
    }

    const anchor = index >= 0 ? entries[index] : { date: reference };
    let previous = null;
    for (let i = entries.length - 1; i >= 0; i--) {
      if (entries[i].date.isBefore(anchor.date, "day")) {
        previous = entries[i];
        break;
      }
    }
    if (!previous) {
      new Notice("No earlier daily note found to fill toward.");
      return;
    }
    const missing = this.getMissingDatesBetween(previous.date, anchor.date, existingSet);
    await this.fillMissingDates(missing);
  }

  promptOpenDailyForDate() {
    if (!this.ensureDailyNotesEnabled()) return;
    new DatePickerModal(this.app, this, async (date) => {
      await this.openDailyNote(date);
    }).open();
  }

  promptFillRange() {
    if (!this.ensureDailyNotesEnabled()) return;
    new RangeModal(this.app, this, async (start, end) => {
      const entries = await this.listDailyNoteEntries();
      const existingSet = this.buildExistingDateSet(entries);
      const missing = this.getMissingDatesBetween(
        start.clone().subtract(1, "day"),
        end.clone().add(1, "day"),
        existingSet
      ).filter((date) => !date.isBefore(start, "day") && !date.isAfter(end, "day"));

      await this.fillMissingDates(missing);
    }).open();
  }

  async showMissingDailyNotes() {
    if (!this.ensureDailyNotesEnabled()) return;

    const entries = await this.listDailyNoteEntries();
    const existingSet = this.buildExistingDateSet(entries);
    const end = window.moment().startOf("day");
    const start = end.clone().subtract(this.settings.gapScanDays, "days");
    const missing = this.getMissingDatesBetween(
      start.clone().subtract(1, "day"),
      end.clone().add(1, "day"),
      existingSet
    ).filter((date) => !date.isBefore(start, "day") && !date.isAfter(end, "day"));

    new MissingDatesModal(this.app, this, missing).open();
  }

  async openAdjacentExisting(direction) {
    if (!this.ensureDailyNotesEnabled()) return;

    const reference = this.getReferenceDate();
    const entries = await this.listDailyNoteEntries();
    if (entries.length === 0) {
      new Notice("No daily notes found yet.");
      return;
    }

    if (direction === "next") {
      const next = entries.find((entry) => entry.date.isAfter(reference, "day"));
      if (!next) {
        new Notice("No later daily note found.");
        return;
      }
      await this.app.workspace.getLeaf(false).openFile(next.file);
      return;
    }

    let previous = null;
    for (let i = entries.length - 1; i >= 0; i--) {
      if (entries[i].date.isBefore(reference, "day")) {
        previous = entries[i];
        break;
      }
    }
    if (!previous) {
      new Notice("No earlier daily note found.");
      return;
    }
    await this.app.workspace.getLeaf(false).openFile(previous.file);
  }
}

class DatePickerModal extends Modal {
  constructor(app, plugin, onSubmit) {
    super(app);
    this.plugin = plugin;
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl, titleEl } = this;
    titleEl.setText("Open daily note for date");
    contentEl.empty();

    const reference = this.plugin.getReferenceDate();
    this.selectedDate = reference.clone();

    new Setting(contentEl)
      .setName("Date")
      .setDesc("Open this date if it exists, otherwise create it from your daily note template.")
      .addText((text) => {
        this.dateInput = text.inputEl;
        this.dateInput.type = "date";
        this.dateInput.value = reference.format("YYYY-MM-DD");
        this.dateInput.addEventListener("change", () => {
          const parsed = window.moment(this.dateInput.value, "YYYY-MM-DD", true);
          if (parsed.isValid()) {
            this.selectedDate = parsed.startOf("day");
          }
        });
      });

    new Setting(contentEl).addButton((button) => {
      button
        .setButtonText("Open")
        .setCta()
        .onClick(() => {
          void this.onSubmit(this.selectedDate);
          this.close();
        });
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}

class RangeModal extends Modal {
  constructor(app, plugin, onSubmit) {
    super(app);
    this.plugin = plugin;
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl, titleEl } = this;
    titleEl.setText("Fill missing daily notes in range");
    contentEl.empty();

    const reference = this.plugin.getReferenceDate();
    this.startDate = reference.clone().subtract(7, "days");
    this.endDate = reference.clone();

    new Setting(contentEl)
      .setName("Start date")
      .addText((text) => {
        text.inputEl.type = "date";
        text.inputEl.value = this.startDate.format("YYYY-MM-DD");
        text.onChange((value) => {
          const parsed = window.moment(value, "YYYY-MM-DD", true);
          if (parsed.isValid()) this.startDate = parsed.startOf("day");
        });
      });

    new Setting(contentEl)
      .setName("End date")
      .addText((text) => {
        text.inputEl.type = "date";
        text.inputEl.value = this.endDate.format("YYYY-MM-DD");
        text.onChange((value) => {
          const parsed = window.moment(value, "YYYY-MM-DD", true);
          if (parsed.isValid()) this.endDate = parsed.startOf("day");
        });
      });

    new Setting(contentEl).addButton((button) => {
      button
        .setButtonText("Fill missing notes")
        .setCta()
        .onClick(() => {
          if (this.endDate.isBefore(this.startDate, "day")) {
            new Notice("End date must be on or after start date.");
            return;
          }
          void this.onSubmit(this.startDate, this.endDate);
          this.close();
        });
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}

class MissingDatesModal extends Modal {
  constructor(app, plugin, missingDates) {
    super(app);
    this.plugin = plugin;
    this.missingDates = missingDates;
  }

  onOpen() {
    const { contentEl, titleEl } = this;
    titleEl.setText("Missing daily notes");
    contentEl.empty();
    contentEl.addClass("daily-gaps-modal");

    if (this.missingDates.length === 0) {
      contentEl.createEl("p", {
        text: "No missing daily notes in the selected period.",
      });
      return;
    }

    contentEl.createEl("p", {
      text: `${this.missingDates.length} missing day${this.missingDates.length > 1 ? "s" : ""} found.`,
    });

    const list = contentEl.createDiv({ cls: "daily-gaps-list" });
    for (const date of this.missingDates) {
      const row = list.createDiv({ cls: "daily-gaps-row" });
      row.createSpan({ text: date.format("YYYY-MM-DD"), cls: "daily-gaps-date" });
      const openButton = row.createEl("button", { text: "Open" });
      openButton.addEventListener("click", () => {
        void this.plugin.openDailyNote(date);
      });
    }

    new Setting(contentEl).addButton((button) => {
      button
        .setButtonText("Fill all missing notes")
        .setCta()
        .onClick(() => {
          void this.plugin.fillMissingDates(this.missingDates);
          this.close();
        });
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}

class DailyGapsSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Gap scan period")
      .setDesc("How many days back to search when listing missing daily notes.")
      .addText((text) => {
        text
          .setPlaceholder("90")
          .setValue(String(this.plugin.settings.gapScanDays))
          .onChange(async (value) => {
            const parsed = Number.parseInt(value, 10);
            if (Number.isNaN(parsed) || parsed < 1) return;
            this.plugin.settings.gapScanDays = parsed;
            await this.plugin.saveData(this.plugin.settings);
          });
      });
  }
}

module.exports = DailyGapsPlugin;
