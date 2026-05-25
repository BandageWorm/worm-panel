# Notes Module — 设计文档

## 存储方式

笔记以 .md 文件存储在 `data/notes/` 目录，直接使用文件系统：

```
data/notes/
├── 2024-01-15-部署记录.md
├── 2024-01-20-故障排查.md
└── 常用命令.md
```

文件名规则：如果用户不指定，默认 `{YYYY-MM-DD}-{标题拼音或英文}.md`

## API 设计

```
GET    /api/notes                  # 笔记列表（文件名 + 更新时间）
GET    /api/notes/:name            # 获取笔记内容
POST   /api/notes                  # 创建笔记 { name, content }
PUT    /api/notes/:name            # 更新笔记内容
DELETE /api/notes/:name            # 删除笔记
```

## 前端

- 左侧栏：笔记列表（文件名、更新时间排序）
- 右侧：分屏模式，上/左编辑区 + 下/右预览区
- 编辑区使用 Markdown 编辑器（如 md-editor-v3）
- 预览区渲染 Markdown 为 HTML
- 工具栏：新建、保存、删除

## 后端实现

```javascript
// services/notes.js
const NOTES_DIR = path.join(dataDir, 'notes');

class NotesService {
  list()       // fs.readdir + stat → [{ name, updatedAt }]
  get(name)    // fs.readFile → content
  create(data) // fs.writeFile → 创建 .md 文件
  update(data) // fs.writeFile → 覆盖
  delete(name) // fs.unlink → 删除文件
}
```
