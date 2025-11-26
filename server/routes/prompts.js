const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database/init');
const { defaultPrompts } = require('../database/seeds/prompts');

// 获取所有模板
router.get('/', (req, res) => {
  try {
    const db = getDatabase();
    const { category, type } = req.query;
    
    let query = 'SELECT * FROM prompt_templates WHERE 1=1';
    const params = [];
    
    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }
    
    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }
    
    query += ' ORDER BY category, type, created_at DESC';
    
    const templates = db.prepare(query).all(...params);
    
    res.json({
      success: true,
      data: templates
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取模板列表失败',
      error: error.message
    });
  }
});

// 获取单个模板
router.get('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    
    const template = db.prepare('SELECT * FROM prompt_templates WHERE id = ?').get(id);
    
    if (!template) {
      return res.status(404).json({
        success: false,
        message: '模板不存在'
      });
    }
    
    res.json({
      success: true,
      data: template
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取模板失败',
      error: error.message
    });
  }
});

// 创建模板
router.post('/', (req, res) => {
  try {
    const db = getDatabase();
    const { category, type, name, description, content, variables } = req.body;
    
    const result = db.prepare(`
      INSERT INTO prompt_templates (category, type, name, description, content, variables, is_default)
      VALUES (?, ?, ?, ?, ?, ?, 0)
    `).run(category, type, name, description, content, JSON.stringify(variables || []));
    
    res.json({
      success: true,
      data: { id: result.lastInsertRowid },
      message: '模板创建成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '创建模板失败',
      error: error.message
    });
  }
});

// 更新模板
router.put('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { name, description, content, variables, is_active } = req.body;
    
    // 获取当前模板
    const currentTemplate = db.prepare('SELECT * FROM prompt_templates WHERE id = ?').get(id);
    if (!currentTemplate) {
      return res.status(404).json({
        success: false,
        message: '模板不存在'
      });
    }
    
    // 保存历史版本
    db.prepare(`
      INSERT INTO prompt_history (template_id, content, version)
      VALUES (?, ?, ?)
    `).run(id, currentTemplate.content, currentTemplate.version);
    
    // 更新模板
    db.prepare(`
      UPDATE prompt_templates SET
        name = ?,
        description = ?,
        content = ?,
        variables = ?,
        is_active = ?,
        version = version + 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name || currentTemplate.name,
      description || currentTemplate.description,
      content || currentTemplate.content,
      JSON.stringify(variables || JSON.parse(currentTemplate.variables || '[]')),
      is_active !== undefined ? (is_active ? 1 : 0) : currentTemplate.is_active,
      id
    );
    
    res.json({
      success: true,
      message: '模板更新成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '更新模板失败',
      error: error.message
    });
  }
});

// 删除模板
router.delete('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    
    // 检查是否为默认模板
    const template = db.prepare('SELECT is_default FROM prompt_templates WHERE id = ?').get(id);
    if (template && template.is_default) {
      return res.status(400).json({
        success: false,
        message: '不能删除默认模板'
      });
    }
    
    db.prepare('DELETE FROM prompt_templates WHERE id = ?').run(id);
    
    res.json({
      success: true,
      message: '模板删除成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '删除模板失败',
      error: error.message
    });
  }
});

// 获取模板历史
router.get('/:id/history', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    
    const history = db.prepare(`
      SELECT * FROM prompt_history 
      WHERE template_id = ? 
      ORDER BY version DESC
    `).all(id);
    
    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取历史失败',
      error: error.message
    });
  }
});

// 恢复到历史版本
router.post('/:id/restore/:historyId', (req, res) => {
  try {
    const db = getDatabase();
    const { id, historyId } = req.params;
    
    const historyRecord = db.prepare('SELECT * FROM prompt_history WHERE id = ?').get(historyId);
    if (!historyRecord) {
      return res.status(404).json({
        success: false,
        message: '历史版本不存在'
      });
    }
    
    // 保存当前版本到历史
    const currentTemplate = db.prepare('SELECT * FROM prompt_templates WHERE id = ?').get(id);
    db.prepare(`
      INSERT INTO prompt_history (template_id, content, version)
      VALUES (?, ?, ?)
    `).run(id, currentTemplate.content, currentTemplate.version);
    
    // 恢复历史版本
    db.prepare(`
      UPDATE prompt_templates SET
        content = ?,
        version = version + 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(historyRecord.content, id);
    
    res.json({
      success: true,
      message: '已恢复到历史版本'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '恢复失败',
      error: error.message
    });
  }
});

// 重置为默认模板
router.post('/reset', (req, res) => {
  try {
    const db = getDatabase();
    const { type, category } = req.body;
    
    // 找到匹配的默认 Prompt
    const defaultPrompt = defaultPrompts.find(p => p.type === type && p.category === category);
    if (!defaultPrompt) {
      return res.status(404).json({
        success: false,
        message: '找不到对应的默认模板'
      });
    }
    
    // 找到当前模板
    const currentTemplate = db.prepare(`
      SELECT * FROM prompt_templates WHERE type = ? AND category = ? AND is_default = 1
    `).get(type, category);
    
    if (!currentTemplate) {
      return res.status(404).json({
        success: false,
        message: '当前模板不存在'
      });
    }
    
    // 保存当前版本到历史
    db.prepare(`
      INSERT INTO prompt_history (template_id, content, version)
      VALUES (?, ?, ?)
    `).run(currentTemplate.id, currentTemplate.content, currentTemplate.version);
    
    // 重置为默认
    db.prepare(`
      UPDATE prompt_templates SET
        content = ?,
        version = version + 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(defaultPrompt.content, currentTemplate.id);
    
    res.json({
      success: true,
      message: '已重置为默认模板'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '重置失败',
      error: error.message
    });
  }
});

// 测试模板
router.post('/:id/test', async (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { variables } = req.body;
    
    const template = db.prepare('SELECT * FROM prompt_templates WHERE id = ?').get(id);
    if (!template) {
      return res.status(404).json({
        success: false,
        message: '模板不存在'
      });
    }
    
    // 替换变量
    let content = template.content;
    if (variables) {
      Object.entries(variables).forEach(([key, value]) => {
        content = content.replace(new RegExp(`{{${key}}}`, 'g'), value);
      });
    }
    
    // 调用 AI（功能锚点：prompt_test）
    const { callAIForFeature, AI_FEATURES } = require('../services/aiService');
    const response = await callAIForFeature(AI_FEATURES.PROMPT_TEST, [
      { role: 'user', content }
    ]);
    
    res.json({
      success: true,
      data: {
        prompt: content,
        response: response.content
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '测试失败',
      error: error.message
    });
  }
});

module.exports = router;
