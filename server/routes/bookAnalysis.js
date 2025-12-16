const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database/init');
const { callAIForFeature } = require('../services/aiService');

// AI 功能锚点
const AI_FEATURE_BOOK_ANALYSIS = 'book_analysis';

/**
 * 获取所有拆书流派列表
 */
router.get('/styles', (req, res) => {
  try {
    const db = getDatabase();
    const styles = db.prepare(`
      SELECT id, style_key, name, description, is_active, sort_order
      FROM book_analysis_styles
      WHERE is_active = 1
      ORDER BY sort_order ASC
    `).all();

    res.json({
      success: true,
      data: styles
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取拆书流派失败',
      error: error.message
    });
  }
});

/**
 * 获取单个拆书流派详情（包含提示词模板）
 */
router.get('/styles/:styleKey', (req, res) => {
  try {
    const db = getDatabase();
    const { styleKey } = req.params;

    const style = db.prepare(`
      SELECT * FROM book_analysis_styles WHERE style_key = ?
    `).get(styleKey);

    if (!style) {
      return res.status(404).json({
        success: false,
        message: '拆书流派不存在'
      });
    }

    res.json({
      success: true,
      data: style
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取拆书流派详情失败',
      error: error.message
    });
  }
});

/**
 * 更新拆书流派（自定义提示词）
 */
router.put('/styles/:styleKey', (req, res) => {
  try {
    const db = getDatabase();
    const { styleKey } = req.params;
    const { prompt_template, description } = req.body;

    const style = db.prepare(`
      SELECT * FROM book_analysis_styles WHERE style_key = ?
    `).get(styleKey);

    if (!style) {
      return res.status(404).json({
        success: false,
        message: '拆书流派不存在'
      });
    }

    db.prepare(`
      UPDATE book_analysis_styles 
      SET prompt_template = ?, description = ?, updated_at = CURRENT_TIMESTAMP
      WHERE style_key = ?
    `).run(prompt_template || style.prompt_template, description || style.description, styleKey);

    res.json({
      success: true,
      message: '更新成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '更新拆书流派失败',
      error: error.message
    });
  }
});

/**
 * 获取按小说分组的章节列表（用于拆书选择）
 */
router.get('/novels', (req, res) => {
  try {
    const db = getDatabase();

    // 获取所有小说及其章节
    const novels = db.prepare(`
      SELECT 
        novel_name,
        author,
        COUNT(*) as chapter_count,
        SUM(word_count) as total_words
      FROM novel_chapters
      WHERE novel_name IS NOT NULL AND novel_name != ''
      GROUP BY novel_name
      ORDER BY MAX(created_at) DESC
    `).all();

    res.json({
      success: true,
      data: novels
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取小说列表失败',
      error: error.message
    });
  }
});

/**
 * 获取指定小说的章节列表
 */
router.get('/novels/:novelName/chapters', (req, res) => {
  try {
    const db = getDatabase();
    const { novelName } = req.params;

    const chapters = db.prepare(`
      SELECT id, title, word_count, analysis_status, created_at
      FROM novel_chapters
      WHERE novel_name = ?
      ORDER BY id ASC
    `).all(novelName);

    // 获取每个章节的拆书分析状态
    const chapterIds = chapters.map(c => c.id);
    if (chapterIds.length > 0) {
      const analyses = db.prepare(`
        SELECT chapter_id, style_key, status, created_at
        FROM chapter_book_analysis
        WHERE chapter_id IN (${chapterIds.join(',')})
      `).all();

      // 按章节ID分组
      const analysisMap = {};
      for (const a of analyses) {
        if (!analysisMap[a.chapter_id]) {
          analysisMap[a.chapter_id] = [];
        }
        analysisMap[a.chapter_id].push(a);
      }

      // 附加到章节数据
      for (const chapter of chapters) {
        chapter.book_analyses = analysisMap[chapter.id] || [];
      }
    }

    res.json({
      success: true,
      data: chapters
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取章节列表失败',
      error: error.message
    });
  }
});

/**
 * AI 拆书分析
 */
router.post('/analyze', async (req, res) => {
  try {
    const db = getDatabase();
    const { chapter_id, style_key, detail_level = 'medium', outline_detail_level = 'medium' } = req.body; // detail_level / outline_detail_level: 'brief' | 'medium' | 'detailed'

    if (!chapter_id || !style_key) {
      return res.status(400).json({
        success: false,
        message: '请提供章节ID和拆书流派'
      });
    }

    // 获取章节内容
    const chapter = db.prepare(`
      SELECT * FROM novel_chapters WHERE id = ?
    `).get(chapter_id);

    if (!chapter) {
      return res.status(404).json({
        success: false,
        message: '章节不存在'
      });
    }

    // 获取拆书流派
    const style = db.prepare(`
      SELECT * FROM book_analysis_styles WHERE style_key = ? AND is_active = 1
    `).get(style_key);

    if (!style) {
      return res.status(404).json({
        success: false,
        message: '拆书流派不存在'
      });
    }

    // 检查是否已有分析结果
    const existingAnalysis = db.prepare(`
      SELECT * FROM chapter_book_analysis 
      WHERE chapter_id = ? AND style_key = ?
    `).get(chapter_id, style_key);

    // 将章节正文按单个换行符分段并在每段前插入段落序号标记 [P1]、[P2] ...（用于提供给 AI）
    const rawParagraphs = String(chapter.content || '')
      .split(/\r?\n/)
      .map(p => p.trim())
      .filter(p => p.length > 0);

    const numberedParagraphs = rawParagraphs.map((p, idx) => `[P${idx + 1}] ${p}`);
    const numberedContent = numberedParagraphs.join('\n');

    // 重新设计的标注式分析提示词
    const annotationInstruction = `
【重要说明 - 标注式分析】
正文已按换行符分段，每段前有标记 [P1], [P2], ... 共 ${rawParagraphs.length} 段。

请以"文档批注"的形式输出分析结果。每个批注（annotation）关联到正文的一个段落区间。

返回格式要求：
{
  "summary": "整体分析摘要（150字以内，概括全章特点）",
  "annotations": [
    {
      "id": 1,
      "paragraph_start": 1,
      "paragraph_end": 3,
      "type": "标注类型（如：情绪变化/情节推进/人物刻画/环境描写/技法运用/节奏控制/结构安排 等）",
      "title": "简短标题（10字以内）",
      "content": "详细分析内容（说明这几段做了什么、用了什么技巧、有什么效果）",
      "technique": "写作技巧（如有）",
      "highlight_text": "值得注意的原文片段（不超过30字，可选）"
    }
  ],
  "outline": [
    {
      "order": 1,
      "paragraph_start": 1,
      "paragraph_end": 3,
      "content_summary": "这部分内容的概要（用于细纲成文练习，30-50字）",
      "word_count_suggest": "建议还原字数"
    }
  ],
  "overall_analysis": {
    "main_theme": "章节主题/主线",
    "key_techniques": ["核心写作技巧列表"],
    "structure_pattern": "结构模式描述"
  }
}

注意：
1. annotations 是核心输出，每个 annotation 就是一条"批注"，标注在正文旁边。
2. **必须覆盖全文所有段落（1..N）**，即 annotations 的区间并集应覆盖所有段落索引，不允许有遗漏。如果某段落没有明显特点，也请为该段落添加一条简短的批注（type 可写为 "无显著变化" 或 "minor"，content 可写为 "该段落未检测到明显写作技巧或情节推进"）。
3. 批注可以跨多段进行综合性分析（如 "P1-P8 整体铺垫了紧张氛围"），也可以针对单段进行精细分析（如 "P5 用短句加速节奏"）。
4. 请在返回结果中包含一个字段 "annotations_coverage" 描述覆盖情况，例如：{ "covered": true, "missing_ranges": [] }。若有遗漏，请在该字段中列出缺失段落的区间。
5. outline 是细纲，用于后续的"细纲成文"练习。
6. 返回结果必须是有效的 JSON 格式`;

    // 根据 detail_level 调整批注密度
    const detailInstructions = {
      brief: '请提供关键批注，聚焦最重要的写作技巧和情节转折点。每条批注言简意赅。可以将多个相似段落合并为一条批注分析。',
      medium: '请提供适量批注，涵盖主要段落的分析。批注内容适中，既有概述也有具体技法分析。根据内容实际情况决定批注数量，确保重要内容都有分析覆盖。',
      detailed: '请提供详细批注，尽可能覆盖全文。对每个重要段落或段落组进行深入分析，包括技法、效果、可借鉴之处。可根据内容复杂度灵活决定批注数量和粒度。'
    };

    const extraDetailInstruction = detailInstructions[detail_level] || detailInstructions.medium;

    // 细纲生成说明（控制细纲详细程度）
    const outlineInstructions = {
      brief: '请生成简短细纲，每条20-40字，覆盖章节主要分块；只输出最关键的主题句。细纲条数根据内容长度和复杂度灵活决定。',
      medium: '请生成细纲，覆盖主要段落或段落组，每条30-50字，包含用于写作还原的摘要和建议字数。细纲条数应与章节内容的结构层次相匹配。',
      detailed: '请生成详细细纲，尽可能覆盖每个重要段落或段落组，每条30-80字，并给出建议字数和写作要点，便于直接用于细纲成文练习。细纲数量应充分反映章节的内容结构。'
    };

    const extraOutlineInstruction = outlineInstructions[outline_detail_level] || outlineInstructions.medium;

    // 调用 AI 进行分析
    const messages = [
      { role: 'system', content: style.prompt_template },
      { role: 'system', content: annotationInstruction },
      { role: 'system', content: extraDetailInstruction },
      { role: 'system', content: `细纲生成说明：${extraOutlineInstruction}` },
      { role: 'user', content: `请分析以下章节内容，以"文档批注"形式输出结果：\n\n【章节标题】${chapter.title}\n\n【章节正文（已编号）】\n${numberedContent}` }
    ];

    const result = await callAIForFeature(AI_FEATURE_BOOK_ANALYSIS, messages, {
      maxTokens: 8192,
      temperature: 0.3
    });

    // 解析返回的 JSON
    let analysisResult;
    try {
      let jsonContent = result.content;
      const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonContent = jsonMatch[1];
      }
      analysisResult = JSON.parse(jsonContent.trim());

      // 处理 annotations 数组，确保每条批注都有正确的段落范围
      if (Array.isArray(analysisResult.annotations)) {
        analysisResult.annotations = analysisResult.annotations.map((ann, idx) => {
          // 确保 id 存在
          if (!ann.id) ann.id = idx + 1;
          
          // 确保段落范围有效
          if (typeof ann.paragraph_start !== 'number' || ann.paragraph_start < 1) {
            ann.paragraph_start = 1;
          }
          if (typeof ann.paragraph_end !== 'number' || ann.paragraph_end < ann.paragraph_start) {
            ann.paragraph_end = ann.paragraph_start;
          }
          
          // 限制范围不超过实际段落数
          ann.paragraph_start = Math.min(ann.paragraph_start, rawParagraphs.length);
          ann.paragraph_end = Math.min(ann.paragraph_end, rawParagraphs.length);
          
          return ann;
        }).filter(ann => ann.paragraph_start && ann.paragraph_end);
        
        // 按段落起始位置排序
        analysisResult.annotations.sort((a, b) => a.paragraph_start - b.paragraph_start);

        // 校验 annotations 是否覆盖所有段落（1..rawParagraphs.length）
        const totalParas = rawParagraphs.length;

        // 先保留原始的 annotations，用于覆盖检查；但有些批注可能是 AI 标注的“无显著变化”，这些不应显示在界面上
        const originalAnnotations = Array.isArray(analysisResult.annotations) ? analysisResult.annotations.slice() : [];

        // 过滤掉不应显示的空批注（如：type 为 "无显著变化" 或 title 中包含 "无显著"，或 content 明确表示未检测到明显）
        const hiddenAnnotations = [];
        function isNoSignificant(a) {
          if (!a) return false;
          const type = String(a.type || '').trim();
          const title = String(a.title || '').trim();
          const content = String(a.content || '').trim();
          if (type === '无显著变化' || type === 'minor') return true;
          if (title.includes('无显著')) return true;
          if (content.includes('未检测到明显') || /无显著/.test(content)) return true;
          return false;
        }

        const visibleAnnotations = (originalAnnotations || []).filter(a => {
          if (isNoSignificant(a)) {
            hiddenAnnotations.push(a);
            return false;
          }
          return true;
        });

        // 计算覆盖情况时使用原始 annotations（包含那些 AI 认为“无显著变化”的段落），以便准确反映 AI 的判断
        const covered = new Array(totalParas + 1).fill(false);
        for (const ann of originalAnnotations) {
          const start = Math.max(1, ann.paragraph_start || ann.paragraph || 1);
          const end = Math.max(start, ann.paragraph_end || ann.paragraph_start || (ann.paragraph || start));
          for (let i = start; i <= end; i++) {
            if (i >= 1 && i <= totalParas) covered[i] = true;
          }
        }

        const missingRanges = [];
        let i = 1;
        while (i <= totalParas) {
          if (!covered[i]) {
            let j = i;
            while (j + 1 <= totalParas && !covered[j + 1]) j++;
            missingRanges.push({ start: i, end: j });
            i = j + 1;
          } else {
            i++;
          }
        }

        // 将可见批注替换回结果（不包含“无显著变化”），并保存隐藏批注信息到元数据
        analysisResult.annotations = visibleAnnotations;
        analysisResult.annotations_coverage = { covered: missingRanges.length === 0, missing_ranges: missingRanges };
        analysisResult._meta = analysisResult._meta || {};
        if (hiddenAnnotations.length > 0) {
          analysisResult._meta.hidden_annotations = hiddenAnnotations.map(a => ({
            paragraph_start: a.paragraph_start || a.paragraph_index || null,
            paragraph_end: a.paragraph_end || a.paragraph_index || a.paragraph_start || null
          }));
          analysisResult._meta.hidden_annotations_count = hiddenAnnotations.length;
        }

        // 不再自动填充“无显著变化”批注以避免在界面上显示这些占位项（由前端通过 annotations_coverage 提示缺失段落）

      }

      // 处理 outline 数组（用于细纲成文）
      if (Array.isArray(analysisResult.outline)) {
        analysisResult.outline = analysisResult.outline.map((item, idx) => {
          if (!item.order) item.order = idx + 1;
          if (typeof item.paragraph_start !== 'number') item.paragraph_start = null;
          if (typeof item.paragraph_end !== 'number') item.paragraph_end = item.paragraph_start;
          return item;
        });
      }

      // 兼容旧格式：如果有 segments 但没有 annotations，转换为 annotations
      if (Array.isArray(analysisResult.segments) && !analysisResult.annotations) {
        analysisResult.annotations = analysisResult.segments.map((seg, idx) => ({
          id: idx + 1,
          paragraph_start: seg.paragraph_start || seg.paragraph_index || 1,
          paragraph_end: seg.paragraph_end || seg.paragraph_start || seg.paragraph_index || 1,
          type: seg.segment_type || seg.type || '分析',
          title: seg.title || seg.summary?.slice(0, 10) || `片段${idx + 1}`,
          content: seg.content || seg.summary || '',
          technique: seg.writing_style || seg.technique || '',
          highlight_text: seg.excerpt || seg.key_text || ''
        }));
      }
    } catch (parseError) {
      console.error('解析AI返回结果失败:', parseError);
      return res.status(500).json({
        success: false,
        message: '分析结果解析失败，请重试',
        raw_content: result.content
      });
    }

    // 记录生成参数以便前端回显
    analysisResult._meta = analysisResult._meta || {};
    analysisResult._meta.detail_level = detail_level;
    analysisResult._meta.outline_detail_level = outline_detail_level;

    // 提取摘要和关键点
    const summary = analysisResult.summary || '';
    const keyPoints = JSON.stringify(analysisResult.outline || []);

    // 保存或更新分析结果
    if (existingAnalysis) {
      db.prepare(`
        UPDATE chapter_book_analysis 
        SET analysis_result = ?, summary = ?, key_points = ?, 
            status = 'completed', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(JSON.stringify(analysisResult), summary, keyPoints, existingAnalysis.id);

      res.json({
        success: true,
        data: {
          id: existingAnalysis.id,
          chapter_id,
          style_key,
          analysis_result: analysisResult,
          summary,
          is_update: true
        },
        message: '拆书分析更新成功'
      });
    } else {
      const insertResult = db.prepare(`
        INSERT INTO chapter_book_analysis 
        (chapter_id, style_key, analysis_result, summary, key_points, status)
        VALUES (?, ?, ?, ?, ?, 'completed')
      `).run(chapter_id, style_key, JSON.stringify(analysisResult), summary, keyPoints);

      res.json({
        success: true,
        data: {
          id: insertResult.lastInsertRowid,
          chapter_id,
          style_key,
          analysis_result: analysisResult,
          summary,
          is_update: false
        },
        message: '拆书分析完成'
      });
    }
  } catch (error) {
    console.error('拆书分析失败:', error);
    res.status(500).json({
      success: false,
      message: '拆书分析失败',
      error: error.message
    });
  }
});

/**
 * 获取章节的拆书分析结果
 */
router.get('/analysis/:chapterId', (req, res) => {
  try {
    const db = getDatabase();
    const { chapterId } = req.params;
    const { style_key } = req.query;

    let query = `
      SELECT cba.*, nc.title as chapter_title, nc.novel_name, nc.content as chapter_content
      FROM chapter_book_analysis cba
      JOIN novel_chapters nc ON cba.chapter_id = nc.id
      WHERE cba.chapter_id = ?
    `;
    const params = [chapterId];

    if (style_key) {
      query += ' AND cba.style_key = ?';
      params.push(style_key);
    }

    query += ' ORDER BY cba.created_at DESC';

    const analyses = db.prepare(query).all(...params);

    // 解析 JSON 字段
    for (const analysis of analyses) {
      try {
        analysis.analysis_result = JSON.parse(analysis.analysis_result);
        analysis.key_points = JSON.parse(analysis.key_points || '[]');
      } catch (e) {
        // 保持原始字符串
      }
    }

    res.json({
      success: true,
      data: style_key ? analyses[0] || null : analyses
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取拆书分析结果失败',
      error: error.message
    });
  }
});

/**
 * 获取单个分析详情
 */
router.get('/analysis/detail/:analysisId', (req, res) => {
  try {
    const db = getDatabase();
    const { analysisId } = req.params;

    const analysis = db.prepare(`
      SELECT cba.*, nc.title as chapter_title, nc.novel_name, nc.content as chapter_content, nc.word_count
      FROM chapter_book_analysis cba
      JOIN novel_chapters nc ON cba.chapter_id = nc.id
      WHERE cba.id = ?
    `).get(analysisId);

    if (!analysis) {
      return res.status(404).json({
        success: false,
        message: '分析结果不存在'
      });
    }

    // 解析 JSON 字段
    try {
      analysis.analysis_result = JSON.parse(analysis.analysis_result);
      analysis.key_points = JSON.parse(analysis.key_points || '[]');
    } catch (e) {
      // 保持原始字符串
    }

    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取分析详情失败',
      error: error.message
    });
  }
});

/**
 * 删除拆书分析结果
 */
router.delete('/analysis/:analysisId', (req, res) => {
  try {
    const db = getDatabase();
    const { analysisId } = req.params;

    db.prepare('DELETE FROM chapter_book_analysis WHERE id = ?').run(analysisId);

    res.json({
      success: true,
      message: '删除成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '删除失败',
      error: error.message
    });
  }
});

/**
 * 创建细纲成文练习
 */
router.post('/practice', (req, res) => {
  try {
    const db = getDatabase();
    const { analysis_id } = req.body;

    if (!analysis_id) {
      return res.status(400).json({
        success: false,
        message: '请提供分析ID'
      });
    }

    // 获取分析结果
    const analysis = db.prepare(`
      SELECT cba.*, nc.content as original_content, nc.id as chapter_id
      FROM chapter_book_analysis cba
      JOIN novel_chapters nc ON cba.chapter_id = nc.id
      WHERE cba.id = ?
    `).get(analysis_id);

    if (!analysis) {
      return res.status(404).json({
        success: false,
        message: '分析结果不存在'
      });
    }

    // 提取细纲内容
    let outlineContent;
    try {
      const analysisResult = JSON.parse(analysis.analysis_result);
      outlineContent = JSON.stringify(analysisResult.outline || [], null, 2);
    } catch (e) {
      outlineContent = analysis.key_points || '[]';
    }

    // 创建练习记录
    const result = db.prepare(`
      INSERT INTO outline_to_text_practices 
      (analysis_id, chapter_id, style_key, outline_content, original_content, started_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(analysis_id, analysis.chapter_id, analysis.style_key, outlineContent, analysis.original_content);

    res.json({
      success: true,
      data: {
        id: result.lastInsertRowid,
        analysis_id,
        chapter_id: analysis.chapter_id,
        style_key: analysis.style_key,
        outline_content: JSON.parse(outlineContent)
      },
      message: '练习创建成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '创建练习失败',
      error: error.message
    });
  }
});

/**
 * 获取练习详情
 */
router.get('/practice/:practiceId', (req, res) => {
  try {
    const db = getDatabase();
    const { practiceId } = req.params;

    const practice = db.prepare(`
      SELECT otp.*, 
             nc.title as chapter_title, 
             nc.novel_name,
             cba.analysis_result,
             cba.summary as analysis_summary
      FROM outline_to_text_practices otp
      JOIN novel_chapters nc ON otp.chapter_id = nc.id
      JOIN chapter_book_analysis cba ON otp.analysis_id = cba.id
      WHERE otp.id = ?
    `).get(practiceId);

    if (!practice) {
      return res.status(404).json({
        success: false,
        message: '练习不存在'
      });
    }

    // 解析 JSON 字段
    try {
      practice.outline_content = JSON.parse(practice.outline_content);
      practice.analysis_result = JSON.parse(practice.analysis_result);
      if (practice.ai_evaluation) {
        practice.ai_evaluation = JSON.parse(practice.ai_evaluation);
      }
    } catch (e) {
      // 保持原始
    }

    res.json({
      success: true,
      data: practice
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取练习详情失败',
      error: error.message
    });
  }
});

/**
 * 保存练习草稿
 */
router.put('/practice/:practiceId/draft', (req, res) => {
  try {
    const db = getDatabase();
    const { practiceId } = req.params;
    const { user_content, time_spent } = req.body;

    const wordCount = (user_content || '').replace(/\s/g, '').length;

    db.prepare(`
      UPDATE outline_to_text_practices 
      SET user_content = ?, word_count = ?, time_spent = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(user_content, wordCount, time_spent || 0, practiceId);

    res.json({
      success: true,
      message: '草稿保存成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '保存草稿失败',
      error: error.message
    });
  }
});

/**
 * 提交练习并获取 AI 评价
 */
router.post('/practice/:practiceId/submit', async (req, res) => {
  try {
    const db = getDatabase();
    const { practiceId } = req.params;
    const { user_content, time_spent } = req.body;

    // 获取练习信息
    const practice = db.prepare(`
      SELECT otp.*, nc.title as chapter_title, cba.analysis_result
      FROM outline_to_text_practices otp
      JOIN novel_chapters nc ON otp.chapter_id = nc.id
      JOIN chapter_book_analysis cba ON otp.analysis_id = cba.id
      WHERE otp.id = ?
    `).get(practiceId);

    if (!practice) {
      return res.status(404).json({
        success: false,
        message: '练习不存在'
      });
    }

    const wordCount = (user_content || '').replace(/\s/g, '').length;

    // 获取拆书流派信息
    const style = db.prepare(`
      SELECT name FROM book_analysis_styles WHERE style_key = ?
    `).get(practice.style_key);

    // AI 评价提示词
    const evaluationPrompt = `你是一位专业的写作导师，请对学生的"细纲成文"练习进行评价。

学生根据【${style?.name || practice.style_key}】拆书法生成的细纲，自己写出了正文。

请从以下维度进行评价：
1. 还原度：与原文在内容、情节、情绪上的契合程度
2. 表达力：语言表达的生动性、准确性
3. 结构性：段落组织、层次安排是否合理
4. 个人风格：是否有自己的特色，而非机械模仿
5. 细纲应用：是否有效运用了细纲中的要点

请输出 JSON 格式的评价结果：
{
  "scores": {
    "restoration": { "score": 0-100, "comment": "评语" },
    "expression": { "score": 0-100, "comment": "评语" },
    "structure": { "score": 0-100, "comment": "评语" },
    "personal_style": { "score": 0-100, "comment": "评语" },
    "outline_usage": { "score": 0-100, "comment": "评语" }
  },
  "total_score": 0-100,
  "highlights": ["亮点1", "亮点2"],
  "improvements": ["改进建议1", "改进建议2"],
  "overall_comment": "总体评价（100字以内）",
  "comparison_notes": "与原文对比的关键差异点（100字以内）"
}`;

    const messages = [
      { role: 'system', content: evaluationPrompt },
      {
        role: 'user',
        content: `【章节标题】${practice.chapter_title}

【拆书细纲】
${practice.outline_content}

【学生作品】
${user_content}

【原文参考】
${practice.original_content}`
      }
    ];

    const result = await callAIForFeature(AI_FEATURE_BOOK_ANALYSIS, messages, {
      maxTokens: 4096,
      temperature: 0.3
    });

    // 解析评价结果
    let evaluation;
    let totalScore = 0;
    try {
      let jsonContent = result.content;
      const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonContent = jsonMatch[1];
      }
      evaluation = JSON.parse(jsonContent.trim());
      totalScore = evaluation.total_score || 0;
    } catch (e) {
      evaluation = { raw_response: result.content, parse_error: true };
    }

    // 更新练习记录
    db.prepare(`
      UPDATE outline_to_text_practices 
      SET user_content = ?, word_count = ?, time_spent = ?, 
          status = 'submitted', ai_evaluation = ?, ai_score = ?,
          submitted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(user_content, wordCount, time_spent || 0, JSON.stringify(evaluation), totalScore, practiceId);

    res.json({
      success: true,
      data: {
        evaluation,
        total_score: totalScore,
        word_count: wordCount
      },
      message: '提交成功'
    });
  } catch (error) {
    console.error('提交练习失败:', error);
    res.status(500).json({
      success: false,
      message: '提交练习失败',
      error: error.message
    });
  }
});

/**
 * 获取练习历史列表
 */
router.get('/practices', (req, res) => {
  try {
    const db = getDatabase();
    const { page = 1, pageSize = 20, status, style_key, novel_name } = req.query;

    let query = `
      SELECT otp.id, otp.chapter_id, otp.style_key, otp.word_count, otp.time_spent,
             otp.status, otp.ai_score, otp.created_at, otp.submitted_at,
             nc.title as chapter_title, nc.novel_name,
             bas.name as style_name
      FROM outline_to_text_practices otp
      JOIN novel_chapters nc ON otp.chapter_id = nc.id
      LEFT JOIN book_analysis_styles bas ON otp.style_key = bas.style_key
      WHERE 1=1
    `;
    let countQuery = `
      SELECT COUNT(*) as total 
      FROM outline_to_text_practices otp
      JOIN novel_chapters nc ON otp.chapter_id = nc.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ' AND otp.status = ?';
      countQuery += ' AND otp.status = ?';
      params.push(status);
    }

    if (style_key) {
      query += ' AND otp.style_key = ?';
      countQuery += ' AND otp.style_key = ?';
      params.push(style_key);
    }

    if (novel_name) {
      query += ' AND nc.novel_name = ?';
      countQuery += ' AND nc.novel_name = ?';
      params.push(novel_name);
    }

    const total = db.prepare(countQuery).get(...params).total;

    query += ' ORDER BY otp.created_at DESC LIMIT ? OFFSET ?';
    const offset = (parseInt(page) - 1) * parseInt(pageSize);

    const practices = db.prepare(query).all(...params, parseInt(pageSize), offset);

    res.json({
      success: true,
      data: {
        list: practices,
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取练习列表失败',
      error: error.message
    });
  }
});

/**
 * 删除练习
 */
router.delete('/practice/:practiceId', (req, res) => {
  try {
    const db = getDatabase();
    const { practiceId } = req.params;

    db.prepare('DELETE FROM outline_to_text_practices WHERE id = ?').run(practiceId);

    res.json({
      success: true,
      message: '删除成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '删除失败',
      error: error.message
    });
  }
});

/**
 * 获取拆书学习统计
 */
router.get('/statistics', (req, res) => {
  try {
    const db = getDatabase();

    // 分析总数
    const analysisCount = db.prepare(`
      SELECT COUNT(*) as count FROM chapter_book_analysis
    `).get().count;

    // 按流派统计
    const styleStats = db.prepare(`
      SELECT style_key, COUNT(*) as count
      FROM chapter_book_analysis
      GROUP BY style_key
    `).all();

    // 练习总数
    const practiceCount = db.prepare(`
      SELECT COUNT(*) as count FROM outline_to_text_practices
    `).get().count;

    // 练习状态统计
    const practiceStatusStats = db.prepare(`
      SELECT status, COUNT(*) as count
      FROM outline_to_text_practices
      GROUP BY status
    `).all();

    // 平均分数
    const avgScore = db.prepare(`
      SELECT AVG(ai_score) as avg_score
      FROM outline_to_text_practices
      WHERE ai_score IS NOT NULL AND ai_score > 0
    `).get().avg_score || 0;

    // 总练习字数
    const totalWords = db.prepare(`
      SELECT SUM(word_count) as total
      FROM outline_to_text_practices
    `).get().total || 0;

    // 总练习时间
    const totalTime = db.prepare(`
      SELECT SUM(time_spent) as total
      FROM outline_to_text_practices
    `).get().total || 0;

    res.json({
      success: true,
      data: {
        analysis_count: analysisCount,
        style_stats: styleStats,
        practice_count: practiceCount,
        practice_status_stats: practiceStatusStats,
        avg_score: Math.round(avgScore * 10) / 10,
        total_words: totalWords,
        total_time: totalTime
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取统计数据失败',
      error: error.message
    });
  }
});

// ==================== 手动拆书批注 API ====================

/**
 * 获取章节详情（用于手动批注）
 */
router.get('/chapter/:chapterId', (req, res) => {
  try {
    const db = getDatabase();
    const { chapterId } = req.params;

    const chapter = db.prepare(`
      SELECT id, title, novel_name, author, content, word_count, created_at
      FROM novel_chapters WHERE id = ?
    `).get(chapterId);

    if (!chapter) {
      return res.status(404).json({
        success: false,
        message: '章节不存在'
      });
    }

    res.json({
      success: true,
      data: chapter
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取章节详情失败',
      error: error.message
    });
  }
});

/**
 * 保存手动批注
 */
router.post('/manual-annotation/:chapterId', (req, res) => {
  try {
    const db = getDatabase();
    const { chapterId } = req.params;
    const { annotations, outline, summary } = req.body;

    // 检查章节是否存在
    const chapter = db.prepare('SELECT id FROM novel_chapters WHERE id = ?').get(chapterId);
    if (!chapter) {
      return res.status(404).json({
        success: false,
        message: '章节不存在'
      });
    }

    // 检查是否已有手动批注记录
    const existing = db.prepare(`
      SELECT id FROM chapter_book_analysis 
      WHERE chapter_id = ? AND style_key = 'manual'
    `).get(chapterId);

    const analysisResult = {
      annotations: annotations || [],
      outline: outline || [],
      summary: summary || '',
      is_manual: true
    };

    if (existing) {
      // 更新
      db.prepare(`
        UPDATE chapter_book_analysis 
        SET analysis_result = ?, summary = ?, key_points = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        JSON.stringify(analysisResult),
        summary || '',
        JSON.stringify(outline || []),
        existing.id
      );
    } else {
      // 插入
      db.prepare(`
        INSERT INTO chapter_book_analysis 
        (chapter_id, style_key, analysis_result, summary, key_points, status)
        VALUES (?, 'manual', ?, ?, ?, 'completed')
      `).run(
        chapterId,
        JSON.stringify(analysisResult),
        summary || '',
        JSON.stringify(outline || [])
      );
    }

    res.json({
      success: true,
      message: '保存成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '保存手动批注失败',
      error: error.message
    });
  }
});

/**
 * 获取手动批注
 */
router.get('/manual-annotation/:chapterId', (req, res) => {
  try {
    const db = getDatabase();
    const { chapterId } = req.params;

    const analysis = db.prepare(`
      SELECT * FROM chapter_book_analysis 
      WHERE chapter_id = ? AND style_key = 'manual'
    `).get(chapterId);

    if (!analysis) {
      return res.json({
        success: true,
        data: null
      });
    }

    // 解析 JSON
    try {
      analysis.analysis_result = JSON.parse(analysis.analysis_result);
    } catch (e) {}

    res.json({
      success: true,
      data: {
        annotations: analysis.analysis_result?.annotations || [],
        outline: analysis.analysis_result?.outline || [],
        summary: analysis.summary || ''
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取手动批注失败',
      error: error.message
    });
  }
});

/**
 * 从手动批注创建细纲成文练习
 */
router.post('/practice-from-manual', (req, res) => {
  try {
    const db = getDatabase();
    const { chapter_id, annotations, outline, summary } = req.body;

    if (!chapter_id || !outline || outline.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请提供章节ID和细纲内容'
      });
    }

    // 获取章节内容
    const chapter = db.prepare(`
      SELECT id, content FROM novel_chapters WHERE id = ?
    `).get(chapter_id);

    if (!chapter) {
      return res.status(404).json({
        success: false,
        message: '章节不存在'
      });
    }

    // 先保存手动批注（如果有）
    const analysisResult = {
      annotations: annotations || [],
      outline: outline,
      summary: summary || '',
      is_manual: true
    };

    // 检查是否已有手动批注记录
    let analysisId;
    const existing = db.prepare(`
      SELECT id FROM chapter_book_analysis 
      WHERE chapter_id = ? AND style_key = 'manual'
    `).get(chapter_id);

    if (existing) {
      db.prepare(`
        UPDATE chapter_book_analysis 
        SET analysis_result = ?, summary = ?, key_points = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        JSON.stringify(analysisResult),
        summary || '',
        JSON.stringify(outline),
        existing.id
      );
      analysisId = existing.id;
    } else {
      const insertResult = db.prepare(`
        INSERT INTO chapter_book_analysis 
        (chapter_id, style_key, analysis_result, summary, key_points, status)
        VALUES (?, 'manual', ?, ?, ?, 'completed')
      `).run(
        chapter_id,
        JSON.stringify(analysisResult),
        summary || '',
        JSON.stringify(outline)
      );
      analysisId = insertResult.lastInsertRowid;
    }

    // 创建练习记录
    const result = db.prepare(`
      INSERT INTO outline_to_text_practices 
      (analysis_id, chapter_id, style_key, outline_content, original_content, started_at)
      VALUES (?, ?, 'manual', ?, ?, CURRENT_TIMESTAMP)
    `).run(analysisId, chapter_id, JSON.stringify(outline), chapter.content);

    res.json({
      success: true,
      data: {
        id: result.lastInsertRowid,
        analysis_id: analysisId,
        chapter_id,
        style_key: 'manual',
        outline_content: outline
      },
      message: '练习创建成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '创建练习失败',
      error: error.message
    });
  }
});

// ==================== 遮蔽练习 API ====================

/**
 * 创建遮蔽练习
 */
router.post('/mask-practice', (req, res) => {
  try {
    const db = getDatabase();
    const { analysis_id, masked_blocks } = req.body;

    if (!analysis_id || !masked_blocks || masked_blocks.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请提供分析ID和遮蔽块'
      });
    }

    // 获取分析结果
    const analysis = db.prepare(`
      SELECT cba.*, nc.content as original_content, nc.id as chapter_id
      FROM chapter_book_analysis cba
      JOIN novel_chapters nc ON cba.chapter_id = nc.id
      WHERE cba.id = ?
    `).get(analysis_id);

    if (!analysis) {
      return res.status(404).json({
        success: false,
        message: '分析结果不存在'
      });
    }

    // 解析分析结果获取细纲
    let outlineContent;
    try {
      const analysisResult = JSON.parse(analysis.analysis_result);
      outlineContent = JSON.stringify(analysisResult.outline || []);
    } catch (e) {
      outlineContent = analysis.key_points || '[]';
    }

    // 创建遮蔽练习记录
    const result = db.prepare(`
      INSERT INTO outline_to_text_practices 
      (analysis_id, chapter_id, style_key, outline_content, original_content, 
       practice_type, masked_blocks, started_at)
      VALUES (?, ?, ?, ?, ?, 'mask', ?, CURRENT_TIMESTAMP)
    `).run(
      analysis_id, 
      analysis.chapter_id, 
      analysis.style_key, 
      outlineContent, 
      analysis.original_content,
      JSON.stringify(masked_blocks)
    );

    res.json({
      success: true,
      data: {
        id: result.lastInsertRowid,
        analysis_id,
        chapter_id: analysis.chapter_id,
        style_key: analysis.style_key,
        masked_blocks
      },
      message: '遮蔽练习创建成功'
    });
  } catch (error) {
    console.error('创建遮蔽练习失败:', error);
    res.status(500).json({
      success: false,
      message: '创建遮蔽练习失败',
      error: error.message
    });
  }
});

/**
 * 获取遮蔽练习详情
 */
router.get('/mask-practice/:practiceId', (req, res) => {
  try {
    const db = getDatabase();
    const { practiceId } = req.params;

    const practice = db.prepare(`
      SELECT otp.*, 
             nc.title as chapter_title, 
             nc.novel_name,
             cba.analysis_result
      FROM outline_to_text_practices otp
      JOIN novel_chapters nc ON otp.chapter_id = nc.id
      JOIN chapter_book_analysis cba ON otp.analysis_id = cba.id
      WHERE otp.id = ? AND otp.practice_type = 'mask'
    `).get(practiceId);

    if (!practice) {
      return res.status(404).json({
        success: false,
        message: '遮蔽练习不存在'
      });
    }

    // 解析 JSON 字段
    try {
      practice.outline_content = JSON.parse(practice.outline_content);
      practice.analysis_result = JSON.parse(practice.analysis_result);
      practice.masked_blocks = JSON.parse(practice.masked_blocks || '[]');
      if (practice.user_content) {
        practice.user_content = JSON.parse(practice.user_content);
      }
      if (practice.ai_evaluation) {
        practice.ai_evaluation = JSON.parse(practice.ai_evaluation);
      }
    } catch (e) {}

    res.json({
      success: true,
      data: practice
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取遮蔽练习详情失败',
      error: error.message
    });
  }
});

/**
 * 保存遮蔽练习草稿
 */
router.put('/mask-practice/:practiceId/draft', (req, res) => {
  try {
    const db = getDatabase();
    const { practiceId } = req.params;
    const { user_content, time_spent } = req.body;

    // user_content 是一个对象，key 是块索引，value 是用户写的内容
    const contentStr = JSON.stringify(user_content || {});
    
    // 计算总字数
    let wordCount = 0;
    if (user_content) {
      Object.values(user_content).forEach(content => {
        wordCount += (content || '').replace(/\s/g, '').length;
      });
    }

    db.prepare(`
      UPDATE outline_to_text_practices 
      SET user_content = ?, word_count = ?, time_spent = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND practice_type = 'mask'
    `).run(contentStr, wordCount, time_spent || 0, practiceId);

    res.json({
      success: true,
      message: '草稿保存成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '保存草稿失败',
      error: error.message
    });
  }
});

/**
 * 提交遮蔽练习
 */
router.post('/mask-practice/:practiceId/submit', async (req, res) => {
  try {
    const db = getDatabase();
    const { practiceId } = req.params;
    const { user_content, time_spent } = req.body;

    // 获取练习信息
    const practice = db.prepare(`
      SELECT otp.*, nc.title as chapter_title, cba.analysis_result
      FROM outline_to_text_practices otp
      JOIN novel_chapters nc ON otp.chapter_id = nc.id
      JOIN chapter_book_analysis cba ON otp.analysis_id = cba.id
      WHERE otp.id = ? AND otp.practice_type = 'mask'
    `).get(practiceId);

    if (!practice) {
      return res.status(404).json({
        success: false,
        message: '遮蔽练习不存在'
      });
    }

    // 解析数据
    let maskedBlocks, originalContent, outlineContent;
    try {
      maskedBlocks = JSON.parse(practice.masked_blocks || '[]');
      originalContent = practice.original_content;
      outlineContent = JSON.parse(practice.outline_content || '[]');
    } catch (e) {
      maskedBlocks = [];
      outlineContent = [];
    }

    // 将原文按段落拆分
    const paragraphs = String(originalContent || '')
      .split(/\r?\n/)
      .map(p => p.trim())
      .filter(p => p.length > 0);

    // 计算总字数
    let wordCount = 0;
    if (user_content) {
      Object.values(user_content).forEach(content => {
        wordCount += (content || '').replace(/\s/g, '').length;
      });
    }

    // 获取拆书流派信息
    const style = db.prepare(`
      SELECT name FROM book_analysis_styles WHERE style_key = ?
    `).get(practice.style_key);

    // 构建评价请求
    let comparisonText = '';
    maskedBlocks.forEach((block, idx) => {
      const startIdx = block.paragraph_start - 1;
      const endIdx = block.paragraph_end;
      const originalText = paragraphs.slice(startIdx, endIdx).join('\n');
      const userText = user_content?.[idx] || '（未填写）';
      
      comparisonText += `\n【遮蔽块${idx + 1}】段落 P${block.paragraph_start}-P${block.paragraph_end}\n`;
      comparisonText += `细纲提示：${block.outline_hint || '无'}\n`;
      comparisonText += `原文：${originalText}\n`;
      comparisonText += `用户作品：${userText}\n`;
    });

    // AI 评价提示词
    const evaluationPrompt = `你是一位专业的写作导师，请对学生的"遮蔽还原"练习进行评价。

学生看着完整的章节文本，但有部分正文块被遮蔽，需要根据细纲提示来还原被遮蔽的内容。

请从以下维度进行评价每个遮蔽块的还原情况：
1. 还原度：与原文在内容、情节、情绪上的契合程度
2. 表达力：语言表达的生动性、准确性
3. 连贯性：与前后文的衔接是否自然

请输出 JSON 格式的评价结果：
{
  "blocks": [
    {
      "block_index": 0,
      "scores": {
        "restoration": { "score": 0-100, "comment": "评语" },
        "expression": { "score": 0-100, "comment": "评语" },
        "coherence": { "score": 0-100, "comment": "评语" }
      },
      "block_score": 0-100,
      "highlights": ["亮点"],
      "improvements": ["改进建议"]
    }
  ],
  "total_score": 0-100,
  "overall_comment": "总体评价（100字以内）"
}`;

    const messages = [
      { role: 'system', content: evaluationPrompt },
      {
        role: 'user',
        content: `【章节标题】${practice.chapter_title}\n\n【遮蔽还原对比】${comparisonText}`
      }
    ];

    const result = await callAIForFeature(AI_FEATURE_BOOK_ANALYSIS, messages, {
      maxTokens: 4096,
      temperature: 0.3
    });

    // 解析评价结果
    let evaluation;
    let totalScore = 0;
    try {
      let jsonContent = result.content;
      const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonContent = jsonMatch[1];
      }
      evaluation = JSON.parse(jsonContent.trim());
      totalScore = evaluation.total_score || 0;
    } catch (e) {
      evaluation = { raw_response: result.content, parse_error: true };
    }

    // 更新练习记录
    db.prepare(`
      UPDATE outline_to_text_practices 
      SET user_content = ?, word_count = ?, time_spent = ?, 
          status = 'submitted', ai_evaluation = ?, ai_score = ?,
          submitted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      JSON.stringify(user_content || {}), 
      wordCount, 
      time_spent || 0, 
      JSON.stringify(evaluation), 
      totalScore, 
      practiceId
    );

    res.json({
      success: true,
      data: {
        evaluation,
        total_score: totalScore,
        word_count: wordCount
      },
      message: '提交成功'
    });
  } catch (error) {
    console.error('提交遮蔽练习失败:', error);
    res.status(500).json({
      success: false,
      message: '提交练习失败',
      error: error.message
    });
  }
});

module.exports = router;
