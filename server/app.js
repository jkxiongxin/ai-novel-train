const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./database/init');

// 导入路由
const aiConfigRoutes = require('./routes/aiConfig');
const promptsRoutes = require('./routes/prompts');
const questionsRoutes = require('./routes/questions');
const practicesRoutes = require('./routes/practices');
const evaluationsRoutes = require('./routes/evaluations');
const statisticsRoutes = require('./routes/statistics');
const settingsRoutes = require('./routes/settings');
const dictionaryRoutes = require('./routes/dictionary');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// API 路由
app.use('/api/ai-config', aiConfigRoutes);
app.use('/api/prompts', promptsRoutes);
app.use('/api/questions', questionsRoutes);
app.use('/api/practices', practicesRoutes);
app.use('/api/evaluations', evaluationsRoutes);
app.use('/api/statistics', statisticsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/dictionary', dictionaryRoutes);

// 静态文件服务（生产环境）
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: '服务器内部错误',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 初始化数据库并启动服务
initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`服务器运行在 http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('数据库初始化失败:', err);
    process.exit(1);
  });

module.exports = app;
