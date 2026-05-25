const { Router } = require('express');
const notes = require('../services/notes');
const logger = require('../utils/logger');

const router = Router();

router.get('/', (req, res) => {
  res.json(notes.list());
});

router.get('/:name', (req, res) => {
  try {
    const content = notes.get(req.params.name);
    if (content === null) {
      return res.status(404).json({ error: '笔记不存在' });
    }
    res.json({ name: req.params.name, content });
  } catch (e) {
    logger.error('Notes', `读取笔记 ${req.params.name} 失败`, e);
    res.status(400).json({ error: e.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { name, content } = req.body;
    if (!name) {
      return res.status(400).json({ error: '笔记名称不能为空' });
    }
    const result = notes.create({ name, content });
    res.json(result);
  } catch (e) {
    logger.error('Notes', `创建笔记 ${req.body?.name} 失败`, e);
    res.status(400).json({ error: e.message });
  }
});

router.put('/:name', (req, res) => {
  try {
    const { content } = req.body;
    if (content === undefined) {
      return res.status(400).json({ error: '内容不能为空' });
    }
    notes.update(req.params.name, content);
    res.json({ success: true });
  } catch (e) {
    logger.error('Notes', `更新笔记 ${req.params.name} 失败`, e);
    res.status(400).json({ error: e.message });
  }
});

router.delete('/:name', (req, res) => {
  try {
    notes.del(req.params.name);
    res.json({ success: true });
  } catch (e) {
    logger.error('Notes', `删除笔记 ${req.params.name} 失败`, e);
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
