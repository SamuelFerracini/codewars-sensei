import CodewarsApiClient from "./codewarsApiClient";
import * as vscode from "vscode";
import { slugify, getFileExtension, addModuleExports } from "./utils";
import * as path from "path";
import * as fs from "fs";

class ChallengeService {
  protected kataIds: string[] = [];

  async fetchAndConfirmKata(language: string) {
    if (this.kataIds.length === 0) {
      this.kataIds = await CodewarsApiClient.fetchRandomKataIds(language);
    }

    const randomId = this.kataIds.pop();

    if (randomId) {
      const kata = await CodewarsApiClient.fetchKataData(randomId);

      this.showKataDescription(kata, language, randomId);
    }
  }

  showKataDescription(kata: any, language: string, randomId: string) {
    const panel = vscode.window.createWebviewPanel(
      "kataDescription",
      `Kata: ${kata.name}`,
      vscode.ViewColumn.One,
      { enableScripts: true }
    );

    panel.webview.html = this.getKataWebviewContent(kata);

    panel.webview.onDidReceiveMessage(async (message) => {
      if (message.command === "try") {
        await this.createKataFiles(kata, language, randomId);
        panel.dispose();
      } else if (message.command === "skip") {
        panel.dispose();
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "Fetching another kata...",
            cancellable: false,
          },
          async () => {
            await this.fetchAndConfirmKata(language);
          }
        );
      }
    });
  }

  async createKataFiles(kata: any, language: string, randomId: string) {
    const [prjId, user] = await CodewarsApiClient.fetchKataLinks(
      randomId,
      language
    );

    CodewarsApiClient.setAuthToken(user.jwt);

    if (!prjId) {
      throw new Error("Error");
    }

    const data = await CodewarsApiClient.fetchKataSolution(prjId, language);

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      vscode.window.showErrorMessage("No workspace folder is open.");
      return;
    }

    const workspacePath = workspaceFolders[0].uri.fsPath;
    const kataFolder = path.join(workspacePath, slugify(kata.name));

    if (!fs.existsSync(kataFolder)) {
      fs.mkdirSync(kataFolder, { recursive: true });
    }

    const readmePath = path.join(kataFolder, "description.md");
    fs.writeFileSync(readmePath, kata.description);

    const { content: withExports, functionName } = addModuleExports(data.setup);

    const mainFilePath = path.join(
      kataFolder,
      `solution.${getFileExtension(language)}`
    );
    fs.writeFileSync(
      mainFilePath,
      `// URL: https://www.codewars.com/kata/${kata.id}/train/${language}\n\n${withExports}`
    );

    try {
      const testContent = `const { describe, it } = require("@jest/globals");\n
const { ${functionName} } = require("./solution.js");\n\n${data.exampleFixture}`;

      const testFilePath = path.join(
        kataFolder,
        `solution.test.${getFileExtension(language)}`
      );
      fs.writeFileSync(testFilePath, testContent);
    } catch (error: any) {
      vscode.window.showErrorMessage(
        `Failed to fetch test cases: ${error.message}`
      );
    }

    vscode.window.showInformationMessage(`Kata files created in ${kataFolder}`);
  }

  getKataWebviewContent(kata: any): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${kata.name}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; }
    pre { padding: 10px; border-radius: 5px; overflow-x: auto; }
    button { padding: 10px 15px; margin-right: 10px; cursor: pointer; }
  </style>
</head>
<body>
  <h2><a href="${kata.url}">${kata.name} (${kata.rank.name})</a></h2>
  <pre>${kata.description.replace(/\n/g, "<br>")}</pre>
  <button onclick="sendMessage('try')">Try</button>
  <button onclick="sendMessage('skip')">Skip</button>

  <script>
    function sendMessage(command) {
      window.acquireVsCodeApi().postMessage({ command });
    }
  </script>
</body>
</html>`;
  }
}

export default new ChallengeService();
