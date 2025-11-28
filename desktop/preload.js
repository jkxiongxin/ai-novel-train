const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的 API 到渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 平台信息
  platform: process.platform,
  
  // 版本信息
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron
  },
  
  // 导航事件监听
  onNavigate: (callback) => {
    ipcRenderer.on('navigate', (event, path) => callback(path));
  },
  
  // 移除导航监听
  removeNavigateListener: () => {
    ipcRenderer.removeAllListeners('navigate');
  },

  // ========== 自动更新相关 API ==========
  
  // 获取应用版本
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  
  // 检查更新
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  
  // 下载更新
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  
  // 安装更新并重启
  installUpdate: () => ipcRenderer.invoke('install-update'),
  
  // 获取更新状态
  getUpdateStatus: () => ipcRenderer.invoke('get-update-status'),
  
  // 监听更新状态变化
  onUpdateStatus: (callback) => {
    ipcRenderer.on('update-status', (event, data) => callback(data));
  },
  
  // 移除更新状态监听
  removeUpdateStatusListener: () => {
    ipcRenderer.removeAllListeners('update-status');
  }
});

// 页面加载完成后的处理
window.addEventListener('DOMContentLoaded', () => {
  console.log('Electron preload script loaded');
  console.log('Platform:', process.platform);
  console.log('Node version:', process.versions.node);
  console.log('Electron version:', process.versions.electron);
});
