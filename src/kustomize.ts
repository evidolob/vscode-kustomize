/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { cli, CliExitData } from './cli';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs-extra';
import { KustomizationDocumentProvider } from './kustom-document';

export class KustomizeCli {
  constructor(private readonly cli: string) {}

  async build(path: string | undefined): Promise<void> {
    const argArr = ['build'];
    if (path) {
      argArr.push(await this.ensureDirectory(vscode.Uri.parse(path).fsPath));
    } else {
      if (vscode.workspace.workspaceFolders?.length && vscode.workspace.workspaceFolders?.length > 1) {
        const folder = await vscode.window.showQuickPick(
          vscode.workspace.workspaceFolders?.map((it) => {
            return { label: it.name, uri: it.uri };
          }),
          { canPickMany: false, title: 'Select path to run "kustomize"' }
        );
        if (folder) {
          argArr.push(folder.uri.fsPath);
        }
      }
    }
    const result = await cli.execute(this.cli, argArr);
    console.error(result.stdout);
    if (result.stderr) {
      vscode.window.showErrorMessage(result.stderr);
    }
    if (result.error) {
      vscode.window.showErrorMessage(result.error.message);
    }
  }

  async preview(path: string): Promise<CliExitData> {
    const argArr = ['build'];
    path = await this.ensureDirectory(vscode.Uri.parse(path).fsPath);
    argArr.push(path);
    return await cli.execute(this.cli, argArr);
  }

  private async ensureDirectory(res: string): Promise<string> {
    if ((await fs.stat(res)).isFile()) {
      const resPath = path.parse(res);
      return resPath.dir;
    }
    return res;
  }
}
