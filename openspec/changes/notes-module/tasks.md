# Notes Module — 实现任务

## Task 1: 笔记服务层 [x]

- [x] NotesService 类实现（CRUD 文件操作）
- [x] 笔记列表（按更新时间排序）
- [x] 确保 data/notes/ 目录存在

## Task 2: 笔记 API [x]

- [x] GET /api/notes（笔记列表）
- [x] GET /api/notes/:name（读取笔记内容）
- [x] POST /api/notes（创建笔记）
- [x] PUT /api/notes/:name（更新笔记）
- [x] DELETE /api/notes/:name（删除笔记）

## Task 3: 安全 [x]

- [x] 文件名校验，防止路径穿越（仅允许 .md 文件操作）
- [x] 限制在 data/notes/ 目录范围内

## Task 4: 前端笔记页 [x]

- [x] 左侧笔记列表（文件名、更新时间）
- [x] 右侧 Markdown 编辑器 + 实时预览分屏
- [x] 新建、保存、删除按钮
- [x] 使用 Markdown 渲染组件
