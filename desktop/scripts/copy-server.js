/**
 * 复制服务器文件到 desktop 目录用于打包
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SOURCE_DIR = path.join(__dirname, '..', '..', 'server');
const TARGET_DIR = path.join(__dirname, '..', 'server');
const DESKTOP_DIR = path.join(__dirname, '..');

// 需要排除的文件/目录
const EXCLUDE = [
  'node_modules',
  '.git',
  '.env',
  '.env.local',
  '*.db',
  '*.db-wal',
  '*.db-shm',
  'novel_trainer.db'
];

function shouldExclude(name) {
  return EXCLUDE.some(pattern => {
    if (pattern.startsWith('*')) {
      return name.endsWith(pattern.slice(1));
    }
    return name === pattern;
  });
}

function copyDir(src, dest) {
  // 创建目标目录
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (shouldExclude(entry.name)) {
      console.log(`Skipping: ${entry.name}`);
      continue;
    }

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
      console.log(`Copied: ${entry.name}`);
    }
  }
}

// 清理旧的目标目录
if (fs.existsSync(TARGET_DIR)) {
  fs.rmSync(TARGET_DIR, { recursive: true, force: true });
  console.log('Cleaned old server directory');
}

// 复制服务器文件
console.log('Copying server files...');
copyDir(SOURCE_DIR, TARGET_DIR);
console.log('Server files copied successfully!');

// 安装服务器依赖
console.log('Installing server dependencies...');
try {
  execSync('npm install --omit=dev', {
    cwd: TARGET_DIR,
    stdio: 'inherit'
  });
  console.log('Server dependencies installed successfully!');
} catch (error) {
  console.error('Failed to install server dependencies:', error.message);
  process.exit(1);
}

// 使用 @electron/rebuild 重新编译原生模块
console.log('Rebuilding native modules for Electron...');
try {
  // 获取 electron 版本
  const electronPkgPath = path.join(DESKTOP_DIR, 'node_modules', 'electron', 'package.json');
  const electronPkg = JSON.parse(fs.readFileSync(electronPkgPath, 'utf8'));
  const electronVersion = electronPkg.version;
  
  console.log(`Electron version: ${electronVersion}`);
  
  // 使用 npx 运行 @electron/rebuild
  execSync(`npx @electron/rebuild -v ${electronVersion} -m "${TARGET_DIR}"`, {
    cwd: DESKTOP_DIR,
    stdio: 'inherit',
    env: {
      ...process.env,
      npm_config_runtime: 'electron',
      npm_config_target: electronVersion,
      npm_config_disturl: 'https://electronjs.org/headers'
    }
  });
  console.log('Native modules rebuilt successfully!');
} catch (error) {
  console.error('Failed to rebuild native modules:', error.message);
  process.exit(1);
}
