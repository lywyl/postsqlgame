# Neo-Postgres: Unit 73

一个学 SQL 的小游戏，赛博朋克风格，纯浏览器运行，不需要装数据库。

## 这是啥

想学 SQL 但看文档太无聊，这个游戏（确实算是游戏吧？）从 SELECT 基础一路打到 MVCC 底层原理，8 个章节，每章都有剧情对话和实战关卡。写对 SQL 就能过关，写错了中文有提示。

## 特色：数据库内部可视化

写完 SQL 点执行，不只是看结果——还能看到数据库内部是怎么跑的。

### 可视化了什么

| 功能 | 说明 |
|------|------|
| **执行计划树** | EXPLAIN 结果用 D3 画成树状图，Seq Scan / Index Scan / Nested Loop 都会标清楚，你可以看到这条语句如何执行。 |
| **B+Tree 索引** | **模拟** B+Tree 结构，高亮搜索路径，直观理解索引是怎么工作的 |
| **扫描路径动画** | 多表 JOIN 时，展示 Nested Loop / Hash Join 的执行过程 |
| **MVCC 快照** | 模拟 PostgreSQL 的多版本并发控制，展示事务隔离和版本链。MVCC 部分是自己写的模拟逻辑，不是真正的数据库内部状态 |

### 优缺点

**优点：**

- 纯前端，不用装数据库，打开浏览器就能学
- EXPLAIN 结果来自真实 PostgreSQL（PGLite），不是假数据
- 可视化和 SQL 练习结合，学语法的同时理解原理
- 支持复杂查询的执行计划展示，不只是简单 SELECT

**缺点：**

- 浏览器性能有限，复杂查询的可视化可能卡顿
- MVCC 是模拟的，不是真正的数据库内部状态（真正的 MVCC 在 PostgreSQL 源码里）
- 只支持 PostgreSQL 语法，其他数据库的执行计划结构不同
- B+Tree 是简化版，真实的索引结构更复杂

## 直接玩

👉 **[lywyl.github.io/postsqlgame](https://lywyl.github.io/postsqlgame/)**

打开就能玩，不用装任何东西。

## 本地开发

想改代码或者二次开发：

```bash
git clone https://github.com/lywyl/postsqlgame.git
cd postsqlgame
npm install
npm run dev
```

打开浏览器访问 `http://localhost:5173`。

## 章节内容

| 章节 | 主题 | 学什么 |
|------|------|--------|
| 第 1 章 | 城市档案馆 | SELECT、WHERE、ORDER BY |
| 第 2 章 | 数据关联 | JOIN、子查询 |
| 第 3 章 | 高级查询 | 窗口函数、CTE |
| 第 4 章 | 数据建模 | DDL、约束、表设计 |
| 第 5 章 | 数据变更 | INSERT、UPDATE、DELETE |
| 第 6 章 | 性能优化 | 索引、执行计划 |
| 第 7 章 | 数据库内核 | MVCC、WAL 日志 |
| 第 8 章 | 安全与扩展 | 权限管理、函数、存储过程 |

## License

随便用，注明出处就行。
