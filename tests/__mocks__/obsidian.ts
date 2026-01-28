// Mock Obsidian module for testing
export class TFile {
  path: string = '';
  basename: string = '';
  extension: string = 'md';
  parent: { path: string } | null = null;
}

export class TFolder {
  path: string = '';
  name: string = '';
}

export class Vault {
  getMarkdownFiles(): TFile[] {
    return [];
  }
  getAbstractFileByPath(path: string): TFile | null {
    return null;
  }
  async cachedRead(file: TFile): Promise<string> {
    return '';
  }
  async read(file: TFile): Promise<string> {
    return '';
  }
  async modify(file: TFile, content: string): Promise<void> {}
}

export class MetadataCache {}

export class App {
  vault: Vault = new Vault();
  metadataCache: MetadataCache = new MetadataCache();
  workspace: any = {};
}

export class Plugin {
  app: App = new App();
  async loadData(): Promise<any> {
    return {};
  }
  async saveData(data: any): Promise<void> {}
  registerView(type: string, viewCreator: any): void {}
  addRibbonIcon(icon: string, title: string, callback: () => void): void {}
  addCommand(command: any): void {}
  addSettingTab(tab: any): void {}
  registerEvent(event: any): void {}
}

export class PluginSettingTab {
  app: App;
  plugin: Plugin;
  containerEl: HTMLElement = document.createElement('div');

  constructor(app: App, plugin: Plugin) {
    this.app = app;
    this.plugin = plugin;
  }

  display(): void {}
  hide(): void {}
}

export class Setting {
  constructor(containerEl: HTMLElement) {}
  setName(name: string): this { return this; }
  setDesc(desc: string): this { return this; }
  addText(cb: (text: any) => any): this { return this; }
  addTextArea(cb: (text: any) => any): this { return this; }
  addToggle(cb: (toggle: any) => any): this { return this; }
  addDropdown(cb: (dropdown: any) => any): this { return this; }
}

export class ItemView {
  app: App = new App();
  containerEl: HTMLElement = document.createElement('div');

  getViewType(): string { return ''; }
  getDisplayText(): string { return ''; }
  getIcon(): string { return ''; }
  async onOpen(): Promise<void> {}
  async onClose(): Promise<void> {}
}

export class WorkspaceLeaf {
  view: any;
  async setViewState(state: any): Promise<void> {}
}

export class Menu {
  addItem(cb: (item: any) => any): this { return this; }
  addSeparator(): this { return this; }
  showAtMouseEvent(e: MouseEvent): void {}
}

export class Notice {
  constructor(message: string, timeout?: number) {}
}

export class MarkdownView {
  editor: any;
}

export class Editor {
  getCursor(): { line: number; ch: number } { return { line: 0, ch: 0 }; }
  getLine(line: number): string { return ''; }
  setLine(line: number, text: string): void {}
  replaceRange(text: string, from: any, to?: any): void {}
  setCursor(pos: any): void {}
}
