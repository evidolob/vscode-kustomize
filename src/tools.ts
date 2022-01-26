/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as fs from 'fs-extra';
import * as semver from 'semver';
import { which } from 'shelljs';
import * as vscode from 'vscode';

import * as configData from './tools.json';
import { cli } from './cli';
import { downloadFile } from './util/download';
import * as hasha from 'hasha';
import { untar } from './util/archive';
import { homedir } from 'os';

interface ToolDef {
  description: string;
  vendor: string;
  name: string;
  version: string;
  versionRange: string;
  versionRangeLabel: string;
  filePrefix: string;
  location: string | undefined;
  url: string;
  sha256sum: string;
  dlFileName: string;
  cmdFileName: string;
}
interface ToolsMap {
  [cliName: string]: ToolDef;
}
function loadMetadata(requirements: object): ToolsMap {
  const req = JSON.parse(JSON.stringify(requirements));
  const osFamily = process.platform;
  for (const object in requirements) {
    if (req[object].platform) {
      if (req[object].platform[osFamily]) {
        Object.assign(req[object], req[object].platform[osFamily]);
        delete req[object].platform;
      } else {
        delete req[object];
      }
    }
  }
  return req;
}

const tools: ToolsMap = loadMetadata(configData);

export async function detectCli(cliName: string): Promise<string | undefined> {
  if (tools[cliName].location === undefined) {
    const toolCacheLocation = path.resolve(homedir(), '.vs-kustomize', tools[cliName].cmdFileName);
    const toolLocations: string[] = [toolCacheLocation];

    const whichLocation = which(cliName);
    toolLocations.unshift(whichLocation && whichLocation.stdout);

    const toolLocation = await selectTool(toolLocations, tools[cliName].versionRange).then((location) => {
      if (location && process.platform !== 'win32') {
        fs.chmodSync(location, 0o765);
      }
      return location;
    });
    let response: string | undefined;
    // no tool locally, ask to download
    if (!toolLocation) {
      const cliTool = tools[cliName];

      const installRequest = `Download and install v${cliTool.version}`;
      response = await vscode.window.showInformationMessage(`Cannot find ${cliTool.description} v${cliTool.version}.`, installRequest, 'Cancel');
      if (response === installRequest) {
        const toolDlLocation = path.resolve(homedir(), '.vs-kustomize', cliTool.dlFileName);
        await fs.ensureDir(path.resolve(homedir(), '.vs-kustomize'));
        let action = undefined;
        do {
          await vscode.window.withProgress(
            {
              cancellable: true,
              location: vscode.ProgressLocation.Notification,
              title: `Downloading ${cliTool.description}`,
            },
            (progress: vscode.Progress<{ increment: number; message: string }>) =>
              downloadFile(cliTool.url, toolDlLocation, (dlProgress, increment) => progress.report({ increment, message: `${dlProgress}%` }))
          );

          const sha256sum: string = await hasha.fromFile(toolDlLocation, { algorithm: 'sha256' });
          if (sha256sum !== cliTool.sha256sum) {
            fs.removeSync(toolDlLocation);
            action = await vscode.window.showInformationMessage(`Checksum for downloaded ${cliTool.description} v${cliTool.version} is not correct.`, 'Download again', 'Cancel');
          }
        } while (action === 'Download again');

        if (action !== 'Cancel') {
          if (toolDlLocation.endsWith('.tar.gz')) {
            await untar(toolDlLocation, path.resolve(path.resolve(homedir(), '.vs-kustomize')), cliTool.filePrefix);
            await fs.remove(toolDlLocation);
            tools[cliName].location = path.resolve(homedir(), '.vs-kustomize', cliTool.cmdFileName);
          }
        }
      }
    } else {
      tools[cliName].location = toolLocation;
    }
  }
  return tools[cliName].location;
}

async function selectTool(locations: string[], versionRange: string): Promise<string | undefined> {
  let result: string | undefined = undefined;
  for (const location of locations) {
    // eslint-disable-next-line no-await-in-loop
    if (location && semver.satisfies((await getVersion(location)) ?? '', versionRange)) {
      result = location;
      break;
    }
  }
  return result;
}

async function getVersion(location: string): Promise<string | undefined> {
  let detectedVersion: string | undefined = undefined;
  if (fs.existsSync(location)) {
    const result = await cli.execute(`"${location}"`, ['version', '--short']);
    if (result.stdout) {
      const versionRegExp = /.*([0-9]+\.[0-9]+\.[0-9]+).*/;
      const toolVersion: string[] = result.stdout
        .trim()
        .split('\n')
        .filter((value) => {
          return versionRegExp.test(value);
        })
        .map((value) => {
          const res = versionRegExp.exec(value);
          if (res) {
            return res[1];
          }
          return '';
        });
      if (toolVersion.length) {
        [detectedVersion] = toolVersion;
      }
    }
  }
  return detectedVersion;
}
