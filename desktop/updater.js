/**
 * 自动更新模块
 * 使用 electron-updater 实现应用的自动更新检测和安装
 * 数据存储在用户目录，更新不会影响用户数据
 */

const { autoUpdater } = require('electron-updater');
const { dialog, BrowserWindow, ipcMain } = require('electron');
const log = require('electron-log');

// 配置日志
log.transports.file.level = 'info';
autoUpdater.logger = log;

// 更新状态
let updateAvailable = false;
let updateDownloaded = false;
let downloadProgress = 0;
let updateInfo = null;

/**
 * 初始化自动更新
 * @param {BrowserWindow} mainWindow - 主窗口实例
 */
function initAutoUpdater(mainWindow) {
  // 配置更新选项
  autoUpdater.autoDownload = false; // 不自动下载，让用户选择
  autoUpdater.autoInstallOnAppQuit = true; // 退出时自动安装
  
  // 检查更新时触发
  autoUpdater.on('checking-for-update', () => {
    log.info('正在检查更新...');
    sendStatusToWindow(mainWindow, 'checking');
  });

  // 有可用更新时触发
  autoUpdater.on('update-available', (info) => {
    log.info('发现新版本:', info.version);
    updateAvailable = true;
    updateInfo = info;
    sendStatusToWindow(mainWindow, 'available', info);
    
    // 弹窗提示用户
    showUpdateDialog(mainWindow, info);
  });

  // 没有可用更新时触发
  autoUpdater.on('update-not-available', (info) => {
    log.info('当前已是最新版本');
    updateAvailable = false;
    sendStatusToWindow(mainWindow, 'not-available', info);
  });

  // 下载进度
  autoUpdater.on('download-progress', (progressObj) => {
    downloadProgress = progressObj.percent;
    log.info(`下载进度: ${progressObj.percent.toFixed(2)}%`);
    sendStatusToWindow(mainWindow, 'downloading', {
      percent: progressObj.percent,
      bytesPerSecond: progressObj.bytesPerSecond,
      transferred: progressObj.transferred,
      total: progressObj.total
    });
  });

  // 下载完成
  autoUpdater.on('update-downloaded', (info) => {
    log.info('更新下载完成');
    updateDownloaded = true;
    sendStatusToWindow(mainWindow, 'downloaded', info);
    
    // 提示用户重启安装
    showInstallDialog(mainWindow, info);
  });

  // 更新错误
  autoUpdater.on('error', (error) => {
    log.error('更新错误:', error);
    sendStatusToWindow(mainWindow, 'error', { message: error.message });
  });

  // 注册 IPC 事件处理
  registerIPCHandlers(mainWindow);

  // 应用启动后延迟检查更新（避免影响启动速度）
  setTimeout(() => {
    checkForUpdates(false);
  }, 5000);
}

/**
 * 检查更新
 * @param {boolean} showNoUpdateDialog - 是否在没有更新时显示提示
 */
async function checkForUpdates(showNoUpdateDialog = true) {
  try {
    const result = await autoUpdater.checkForUpdates();
    
    if (showNoUpdateDialog && !updateAvailable) {
      dialog.showMessageBox({
        type: 'info',
        title: '检查更新',
        message: '当前已是最新版本',
        detail: `当前版本: ${require('./package.json').version}`,
        buttons: ['确定']
      });
    }
    
    return result;
  } catch (error) {
    log.error('检查更新失败:', error);
    
    if (showNoUpdateDialog) {
      dialog.showMessageBox({
        type: 'error',
        title: '检查更新失败',
        message: '无法检查更新',
        detail: error.message,
        buttons: ['确定']
      });
    }
    
    throw error;
  }
}

/**
 * 显示更新提示对话框
 */
function showUpdateDialog(mainWindow, info) {
  const releaseNotes = typeof info.releaseNotes === 'string' 
    ? info.releaseNotes 
    : info.releaseNotes?.map(n => n.note).join('\n') || '暂无更新说明';

  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: '发现新版本',
    message: `发现新版本 ${info.version}`,
    detail: `当前版本: ${require('./package.json').version}\n新版本: ${info.version}\n\n更新说明:\n${releaseNotes}\n\n更新不会影响您的数据，是否立即下载？`,
    buttons: ['立即下载', '稍后提醒'],
    defaultId: 0,
    cancelId: 1
  }).then(({ response }) => {
    if (response === 0) {
      // 开始下载
      autoUpdater.downloadUpdate();
      sendStatusToWindow(mainWindow, 'downloading', { percent: 0 });
    }
  });
}

/**
 * 显示安装提示对话框
 */
function showInstallDialog(mainWindow, info) {
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: '更新已就绪',
    message: `新版本 ${info.version} 已下载完成`,
    detail: '重启应用即可完成更新。您的数据将会保留。\n\n是否立即重启？',
    buttons: ['立即重启', '稍后重启'],
    defaultId: 0,
    cancelId: 1
  }).then(({ response }) => {
    if (response === 0) {
      // 退出并安装
      autoUpdater.quitAndInstall(false, true);
    }
  });
}

/**
 * 向渲染进程发送更新状态
 */
function sendStatusToWindow(mainWindow, status, data = {}) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-status', { status, ...data });
  }
}

/**
 * 注册 IPC 事件处理
 */
function registerIPCHandlers(mainWindow) {
  // 手动检查更新
  ipcMain.handle('check-for-updates', async () => {
    return await checkForUpdates(true);
  });

  // 开始下载更新
  ipcMain.handle('download-update', async () => {
    if (updateAvailable) {
      autoUpdater.downloadUpdate();
      return true;
    }
    return false;
  });

  // 安装更新并重启
  ipcMain.handle('install-update', () => {
    if (updateDownloaded) {
      autoUpdater.quitAndInstall(false, true);
      return true;
    }
    return false;
  });

  // 获取当前版本
  ipcMain.handle('get-app-version', () => {
    return require('./package.json').version;
  });

  // 获取更新状态
  ipcMain.handle('get-update-status', () => {
    return {
      updateAvailable,
      updateDownloaded,
      downloadProgress,
      updateInfo
    };
  });
}

/**
 * 添加检查更新菜单项
 */
function getUpdateMenuItem(mainWindow) {
  return {
    label: '检查更新...',
    click: () => {
      checkForUpdates(true);
    }
  };
}

module.exports = {
  initAutoUpdater,
  checkForUpdates,
  getUpdateMenuItem
};
