/* eslint-disable no-console  */

import {app, dialog, ipcMain, SaveDialogOptions, OpenDialogOptions} from 'electron';
import installExtension, {REACT_DEVELOPER_TOOLS, REDUX_DEVTOOLS} from 'electron-devtools-installer';
import ElectronStore from 'electron-store';
import fs from 'fs';

import '@main/Menu';
import MainWindow from '@main/MainWindow';
import {DownloadSigningKeyPayload, getFailChannel, getSuccessChannel, IpcChannel} from '@shared/ipc';

ElectronStore.initRenderer();

const isMac = process.platform === 'darwin';
const gotTheLock = app.requestSingleInstanceLock();

// if gotTheLock is false, another instance of application is already running
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // focus back to the previous instance, if someone tried to create new instance
    if (MainWindow.exists()) {
      if (MainWindow.isMinimized() || !MainWindow.isFocused()) {
        MainWindow.restore();
        MainWindow.focus();
      }
    }
  });
  app.whenReady().then(() => {
    installExtension([REACT_DEVELOPER_TOOLS, REDUX_DEVTOOLS])
      .then((name) => console.log(`Added Extension: ${name}`))
      .catch((error) => console.log('An error occurred: ', error));
  });
  app.on('ready', MainWindow.createWindow);
}

app.setName('TNB Wallet');

app.on('window-all-closed', () => {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (!isMac) {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (MainWindow.getNumOfWindows() === 0) {
    MainWindow.createWindow();
  }
});

ipcMain.on(IpcChannel.downloadSigningKey, async (event, {accountNumber, signingKey}: DownloadSigningKeyPayload) => {
  const options: SaveDialogOptions = {
    buttonLabel: 'Save',
    defaultPath: `${accountNumber}.txt`,
    filters: [
      {extensions: ['txt'], name: 'txt'},
      {extensions: ['*'], name: 'All Files'},
    ],
    title: 'Save Signing Key',
  };

  try {
    const {canceled, filePath} = await dialog.showSaveDialog(options);
    if (canceled || !filePath) return;
    fs.writeFileSync(filePath, signingKey);
    event.reply(getSuccessChannel(IpcChannel.downloadSigningKey));
  } catch (error: any) {
    console.log(`Failed to save file: ${IpcChannel.downloadSigningKey}`, error);
    event.reply(getFailChannel(IpcChannel.downloadSigningKey), error.toString());
  }
});

ipcMain.on(IpcChannel.exportStoreData, async (event, payload: string) => {
  const options: SaveDialogOptions = {
    buttonLabel: 'Export',
    defaultPath: 'store-data.json',
    filters: [
      {extensions: ['json'], name: 'json'},
      {extensions: ['*'], name: 'All Files'},
    ],
    title: 'Export Store Data',
  };

  try {
    const {canceled, filePath} = await dialog.showSaveDialog(options);
    if (canceled || !filePath) return;
    fs.writeFileSync(filePath, payload);
    event.reply(getSuccessChannel(IpcChannel.exportStoreData));
  } catch (error: any) {
    console.log(`Failed to save file: ${IpcChannel.exportStoreData}`, error);
    event.reply(getFailChannel(IpcChannel.exportStoreData), error.toString());
  }
});

ipcMain.on(IpcChannel.importStoreData, async (event) => {
  const options: OpenDialogOptions = {
    buttonLabel: 'Import',
    filters: [
      {extensions: ['json'], name: 'json'},
      {extensions: ['*'], name: 'All Files'},
    ],
    title: 'Import Store Data',
  };

  try {
    const {canceled, filePaths} = await dialog.showOpenDialog(options);
    if (canceled || !filePaths.length) return;
    const filePath = filePaths[0];

    fs.readFile(filePath, 'utf-8', (err, jsonData) => {
      if (err) {
        throw err;
      }

      const data = JSON.parse(jsonData);
      if (!data.managed_banks) {
        event.reply(getFailChannel(IpcChannel.importStoreData), 'Data is improperly formatted');
        return;
      }
      // eslint-disable-next-line no-underscore-dangle
      if (data.__internal__) {
        // eslint-disable-next-line no-underscore-dangle
        delete data.__internal__;
      }

      event.reply(getSuccessChannel(IpcChannel.importStoreData), data);
    });
  } catch (error: any) {
    console.log(`Failed to read file: ${IpcChannel.importStoreData}`, error);
    event.reply(getFailChannel(IpcChannel.importStoreData), error.toString());
  }
});

ipcMain.on(IpcChannel.restartApp, (event) => {
  try {
    console.log('Trying to restart app');
    MainWindow.reloadIgnoringCache();
    setTimeout(() => {
      event.reply(getSuccessChannel(IpcChannel.restartApp));
    }, 1000);
  } catch (error: any) {
    console.log('Failed to restart app', error);
    setTimeout(() => {
      event.reply(getFailChannel(IpcChannel.restartApp), error.toString());
    }, 1000);
  }
});
