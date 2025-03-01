import * as vscode from "vscode";
import keytar from "keytar";
import ChallengeService from "./challengeService";
import CodewarsApiClient from "./codewarsApiClient";

const APP_NAME = "codewars-sensei";

export function registerCommands(context: vscode.ExtensionContext) {
  let randomKataCommand = vscode.commands.registerCommand(
    "codewars.getRandomKata",
    async () => {
      await askForCredentials();

      const language = await askForLanguage();
      if (!language) {
        return;
      }

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Fetching random kata...",
          cancellable: false,
        },
        async () => {
          try {
            await ChallengeService.fetchAndConfirmKata(language);
          } catch (err: any) {
            vscode.window.showErrorMessage(err?.message);
          }
        }
      );
    }
  );

  context.subscriptions.push(randomKataCommand);
}

async function askForCredentials() {
  let credentails = await getCredentials();

  if (!credentails?.account || !credentails?.password) {
    const username = await vscode.window.showInputBox({
      prompt: "Enter your username",
      placeHolder: "Username",
      ignoreFocusOut: true,
    });

    if (!username) {
      vscode.window.showErrorMessage("Username is required");
      return;
    }

    const password = await vscode.window.showInputBox({
      prompt: "Enter your password",
      placeHolder: "Password",
      password: true,
      ignoreFocusOut: true,
    });

    if (!password) {
      vscode.window.showErrorMessage("Password is required");
      return;
    }

    await saveCredentials(username, password);
    vscode.window.showInformationMessage("Credentials saved successfully!");
    credentails.account = username;
    credentails.password = password;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Login in...",
      cancellable: false,
    },
    async () => {
      await CodewarsApiClient.login(credentails.account, credentails.password);
    }
  );
}

async function saveCredentials(username: string, password: string) {
  await keytar.setPassword(APP_NAME, username, password);
}

async function getCredentials() {
  const [credentails] = (await keytar.findCredentials(APP_NAME)) ?? [];

  return credentails;
}

async function askForLanguage(): Promise<string | undefined> {
  const languages = [
    "javascript",
    "python",
    "ruby",
    "java",
    "csharp",
    "cpp",
    "typescript",
  ];
  return await vscode.window.showQuickPick(languages, {
    placeHolder: "Select the language you want to train in",
  });
}
