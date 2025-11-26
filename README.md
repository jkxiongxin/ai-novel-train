## 启动与部署

### 开发环境启动
```bash
# 前端
cd client
npm install
npm run dev

# 后端
cd server
npm install
npm run dev
```

### 生产环境
```bash
# 构建前端
cd client
npm run build

# 启动服务（前端静态文件由后端服务）
cd server
npm run start
```

请确保系统在 `localhost:3000` 启动后即可完全在本地使用，无需任何外部依赖（AI API 除外）。

---

## 支持本项目

如果这个项目对您有帮助，请考虑支持开发者的工作：

![赞赏支持](./docs/zanshang.jpg)

您的支持将帮助我持续改进和完善这个AI网络小说写作训练系统，为更多写作者提供更好的学习体验。感谢您的支持！