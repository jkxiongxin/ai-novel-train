const { app, BrowserWindow, shell, dialog, Menu, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

// 判断是否是开发环境
const isDev = !app.isPackaged;

// 自动更新模块（仅生产环境加载）
let updater = null;
if (!isDev) {
  updater = require('./updater');
}

// 服务器进程引用
let serverProcess = null;
let mainWindow = null;
let serverPort = 3000;

// 获取资源路径
function getResourcePath(relativePath) {
  if (isDev) {
    return path.join(__dirname, '..', relativePath);
  }
  return path.join(process.resourcesPath, relativePath);
}

// 启动内嵌的 Express 服务器
async function startServer() {
  return new Promise((resolve, reject) => {
    try {
      // 设置环境变量
      const serverPath = getResourcePath('server');
      const dbPath = path.join(app.getPath('userData'), 'database.sqlite');

      console.log('Starting server from:', serverPath);
      console.log('Database path:', dbPath);

      // 在生产环境中，我们直接 require 服务器模块而不是 spawn 新进程
      if (!isDev) {
        // 设置环境变量
        process.env.NODE_ENV = 'production';
        process.env.PORT = serverPort.toString();
        process.env.DB_PATH = dbPath;
        // 设置服务器根目录，让服务器内部使用
        process.env.SERVER_ROOT = serverPath;
        
        // 动态加载服务器
        const serverAppPath = path.join(serverPath, 'app.js');
        
        // 加载并启动服务器（不再使用 chdir）
        require(serverAppPath);
        
        // 等待服务器启动
        setTimeout(() => {
          console.log('Server started on port', serverPort);
          resolve();
        }, 2000);
      } else {
        // 开发环境：假设服务器已经在运行
        console.log('Development mode: assuming server is running');
        resolve();
      }
    } catch (error) {
      console.error('Failed to start server:', error);
      reject(error);
    }
  });
}

// 创建主窗口
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    // macOS 使用隐藏式标题栏，Windows 使用标准窗口框架（带菜单栏）
    ...(process.platform === 'darwin' 
      ? { titleBarStyle: 'hiddenInset' } 
      : { frame: true }  // Windows 使用标准窗口框架
    ),
    show: false, // 先隐藏，等加载完成后显示
    backgroundColor: '#f5f7fa'
  });

  // 加载应用
  if (isDev) {
    // 开发环境：加载 Vite 开发服务器
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // 生产环境：加载打包后的静态文件
    const clientPath = path.join(__dirname, 'client-dist', 'index.html');
    mainWindow.loadFile(clientPath);
  }

  // 窗口准备好后显示
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // 处理外部链接
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // 窗口关闭时清理
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Windows: 监听最大化状态变化，通知渲染进程
  if (process.platform !== 'darwin') {
    mainWindow.on('maximize', () => {
      mainWindow?.webContents.send('window-maximize-change', true);
    });
    mainWindow.on('unmaximize', () => {
      mainWindow?.webContents.send('window-maximize-change', false);
    });
  }
}

// 设置窗口控制 IPC 处理程序 (Windows)
function setupWindowControlHandlers() {
  ipcMain.handle('window-minimize', () => {
    mainWindow?.minimize();
  });

  ipcMain.handle('window-maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });

  ipcMain.handle('window-close', () => {
    mainWindow?.close();
  });

  ipcMain.handle('window-is-maximized', () => {
    return mainWindow?.isMaximized() ?? false;
  });
}

// 创建应用菜单
function createMenu() {
  const template = [
    {
      label: 'AI网文训练师',
      submenu: [
        { label: '关于', role: 'about' },
        // 添加检查更新菜单项（仅生产环境）
        ...(updater ? [updater.getUpdateMenuItem(mainWindow)] : []),
        { type: 'separator' },
        { label: '偏好设置', accelerator: 'CmdOrCtrl+,', click: () => {
          mainWindow?.webContents.send('navigate', '/settings');
        }},
        { type: 'separator' },
        { label: '隐藏', role: 'hide' },
        { label: '隐藏其他', role: 'hideOthers' },
        { label: '显示全部', role: 'unhide' },
        { type: 'separator' },
        { label: '退出', role: 'quit' }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { label: '撤销', role: 'undo' },
        { label: '重做', role: 'redo' },
        { type: 'separator' },
        { label: '剪切', role: 'cut' },
        { label: '复制', role: 'copy' },
        { label: '粘贴', role: 'paste' },
        { label: '全选', role: 'selectAll' }
      ]
    },
    {
      label: '视图',
      submenu: [
        { label: '重新加载', role: 'reload' },
        { label: '强制重新加载', role: 'forceReload' },
        { type: 'separator' },
        { label: '实际大小', role: 'resetZoom' },
        { label: '放大', role: 'zoomIn' },
        { label: '缩小', role: 'zoomOut' },
        { type: 'separator' },
        { label: '全屏', role: 'togglefullscreen' }
      ]
    },
    {
      label: '窗口',
      submenu: [
        { label: '最小化', role: 'minimize' },
        { label: '缩放', role: 'zoom' },
        { type: 'separator' },
        { label: '置于最前', role: 'front' }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '使用文档',
          click: async () => {
            await shell.openExternal('https://github.com/jkxiongxin/ai-novel-train');
          }
        },
        {
          label: '开发者工具',
          accelerator: 'Alt+CmdOrCtrl+I',
          click: () => {
            mainWindow?.webContents.toggleDevTools();
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// 应用准备就绪
app.whenReady().then(async () => {
  try {
    // 创建菜单
    createMenu();

    // 设置窗口控制 IPC 处理程序 (Windows)
    if (process.platform !== 'darwin') {
      setupWindowControlHandlers();
    }

    // 启动服务器（仅生产环境）
    if (!isDev) {
      await startServer();
    }

    // 创建窗口
    createWindow();

    // 初始化自动更新（仅生产环境）
    if (updater && mainWindow) {
      updater.initAutoUpdater(mainWindow);
    }

    // macOS: 点击 dock 图标时重新创建窗口
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  } catch (error) {
    console.error('Application startup failed:', error);
    dialog.showErrorBox('启动错误', `应用启动失败: ${error.message}`);
    app.quit();
  }
});

// 所有窗口关闭时退出应用（Windows & Linux）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 应用退出前清理
app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  dialog.showErrorBox('错误', `发生未知错误: ${error.message}`);
});
