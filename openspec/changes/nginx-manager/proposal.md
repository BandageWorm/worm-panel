# Nginx Manager — Nginx 反代管理

## 目标

在面板中可视化管理 Nginx 反代配置，支持快捷添加子域名反代和原生配置文本编辑器。

## 范围

- 可视化添加反代（子域名 → 目标端口）
- Nginx 配置原生文本编辑器（语法高亮）
- nginx -t 校验 → nginx -s reload 流程
- 操作前自动备份配置
- 面板自身反代配置锁定（不可编辑/删除）
- 配置列表展示（sites-enabled 中的 server block）

## 非目标

- 不修改 Nginx 主配置（nginx.conf），只管理 sites-enabled
- 不处理负载均衡、流式反代等高级场景
- 不涉及 SSL 配置（由 ssl-cert 模块处理）
