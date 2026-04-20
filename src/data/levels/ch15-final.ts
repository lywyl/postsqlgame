// TODO: 未启用章节，章节 ID 需重新编号后才能接入 chapters.ts
import type { Chapter } from '../../types'
import { FULL_WORLD_ALL_SQL } from '../world/init'

export const ch15: Chapter = {
  id: 'ch15',
  title: '第 15 章：终极对决',
  description: '综合调优与最终对决：VACUUM / pg_stat / 锁等待 / 全面诊断修复',
  icon: '🏆',
  levels: [
    {
      id: 'ch15-1',
      title: '膨胀危机',
      description: 'ZERO: "警报！系统存储空间正在急剧膨胀，表的大小远超实际数据量。这是死元组堆积导致的——UPDATE 和 DELETE 操作留下的垃圾数据正在吞噬整个数据库。如果不立即清理，系统将在数小时内崩溃！"',
      initSql: FULL_WORLD_ALL_SQL + `
CREATE TABLE bloated_events (
  id SERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  detail TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
INSERT INTO bloated_events (event_type, detail)
SELECT 
  CASE (g % 3) WHEN 0 THEN 'alarm' WHEN 1 THEN 'alert' ELSE 'info' END,
  'Event detail #' || g
FROM generate_series(1, 200) AS g;`,
      defaultSql: `UPDATE bloated_events SET event_type = event_type || '_v2';`,
      tasks: [
        {
          prompt: `Alice: "死元组危机！bloated_events 表已经堆积了大量死元组。我们需要先更新所有行来制造死元组，然后通过 pg_stat_user_tables 查看膨胀情况。"

执行以下操作：
1. 更新 bloated_events 表的所有行，为 event_type 列添加后缀 "_v2"：UPDATE bloated_events SET event_type = event_type || '_v2';
2. 查询 pg_stat_user_tables，查看 bloated_events 表的活元组数（n_live_tup）和死元组数（n_dead_tup）`,
          answerSql: `UPDATE bloated_events SET event_type = event_type || '_v2';
SELECT relname, n_live_tup, n_dead_tup FROM pg_stat_user_tables WHERE relname = 'bloated_events';`,
          checkSql: `SELECT n_dead_tup >= 0 AS has_stats FROM pg_stat_user_tables WHERE relname = 'bloated_events';`,
          hints: [
            `UPDATE 表名 SET 列 = 列 || '_v2'; 为所有行的列值添加后缀`,
            `pg_stat_user_tables 包含每个表的统计信息，包括 n_live_tup（活元组）和 n_dead_tup（死元组）`,
            `UPDATE bloated_events SET event_type = event_type || '_v2';
SELECT relname, n_live_tup, n_dead_tup FROM pg_stat_user_tables WHERE relname = 'bloated_events';`
          ],
          needsTransaction: true,
          successStory: `ZERO: "可怕！n_dead_tup 显示有 200 个死元组——我们的 UPDATE 操作让每一行旧版本都变成了垃圾数据。这些死元组占用了实际存储空间，但不会被查询使用。这就是 MVCC 的代价：为了保证并发一致性，PostgreSQL 保留了行的多个版本，直到 VACUUM 来清理它们。"`
        },
        {
          prompt: `Alice: "现在执行 VACUUM 清理死元组，然后用 ANALYZE 更新统计信息。最后再次检查 pg_stat_user_tables，并查看 pg_stats 中 event_type 列的统计。"

执行以下操作：
1. VACUUM bloated_events 表
2. ANALYZE bloated_events 表
3. 查询 pg_stat_user_tables 查看 bloated_events 的死元组是否减少
4. 查询 pg_stats 查看 bloated_events 表的 event_type 列的统计信息（attname, n_distinct, null_frac）`,
          answerSql: `VACUUM bloated_events;
ANALYZE bloated_events;
SELECT relname, n_live_tup, n_dead_tup FROM pg_stat_user_tables WHERE relname = 'bloated_events';
SELECT attname, n_distinct, null_frac FROM pg_stats WHERE tablename = 'bloated_events' ORDER BY attname;`,
          checkSql: `SELECT 1 AS vacuumed;`,
          hints: [
            `VACUUM 命令清理死元组并释放空间，但默认不会收缩表文件`,
            `ANALYZE 收集统计信息供优化器使用`,
            `VACUUM bloated_events;
ANALYZE bloated_events;
SELECT relname, n_live_tup, n_dead_tup FROM pg_stat_user_tables WHERE relname = 'bloated_events';
SELECT attname, n_distinct, null_frac FROM pg_stats WHERE tablename = 'bloated_events' ORDER BY attname;`
          ],
          needsTransaction: true,
          successStory: `Alice: "VACUUM 完成！死元组已被清理，统计信息也已更新。注意：在 PGlite 中 VACUUM 的效果可能受限，但在真实 PostgreSQL 中，这会显著减少表文件大小。pg_stats 现在显示了 event_type 列的 n_distinct（不同值数量）和 null_frac（空值比例）——这些信息供优化器估算查询成本。定期 VACUUM 和 ANALYZE 是数据库健康的基本保障。"`
        }
      ]
    },
    {
      id: 'ch15-2',
      title: '性能诊断',
      description: `ZERO: "慢查询警报！系统响应时间飙升，用户投诉如潮。这是典型的索引缺失问题——优化器正在进行全表扫描。我们需要 EXPLAIN ANALYZE 找出罪魁祸首，然后创建索引来拯救性能。"`,
      initSql: FULL_WORLD_ALL_SQL,
      defaultSql: `EXPLAIN ANALYZE SELECT c.name, c.salary, d.district_name FROM citizens c JOIN districts d ON c.district_id = d.id WHERE c.salary > 15000 ORDER BY c.salary DESC;`,
      tasks: [
        {
          prompt: `Alice: "性能诊断第一步：找出慢查询的原因。使用 EXPLAIN ANALYZE 分析这个 JOIN 查询，然后创建合适的索引。"

执行以下操作：
1. 用 EXPLAIN ANALYZE 查看查询计划：SELECT c.name, c.salary, d.district_name FROM citizens c JOIN districts d ON c.district_id = d.id WHERE c.salary > 15000 ORDER BY c.salary DESC
2. 在 citizens 表的 salary 列上创建索引，命名为 idx_ch15_citizens_salary
3. 再次用 EXPLAIN ANALYZE 查看同一查询，对比性能提升`,
          answerSql: `EXPLAIN ANALYZE SELECT c.name, c.salary, d.district_name FROM citizens c JOIN districts d ON c.district_id = d.id WHERE c.salary > 15000 ORDER BY c.salary DESC;
CREATE INDEX idx_ch15_citizens_salary ON citizens (salary);
EXPLAIN ANALYZE SELECT c.name, c.salary, d.district_name FROM citizens c JOIN districts d ON c.district_id = d.id WHERE c.salary > 15000 ORDER BY c.salary DESC;`,
          checkSql: `SELECT indexname FROM pg_indexes WHERE tablename = 'citizens' AND indexname = 'idx_ch15_citizens_salary';`,
          needsTransaction: true,
          hints: [
            `EXPLAIN ANALYZE 会实际执行查询并显示真实执行时间`,
            `CREATE INDEX 索引名 ON 表名 (列名); 创建单列索引`,
            `EXPLAIN ANALYZE SELECT ...;
CREATE INDEX idx_ch15_citizens_salary ON citizens (salary);
EXPLAIN ANALYZE SELECT ...;`
          ],
          successStory: `ZERO: "性能提升显著！创建 salary 索引后，查询从全表扫描变成了索引扫描，执行时间大幅下降。注意 Execution Time 的变化——在真实生产环境中，这种优化可能意味着从几秒缩短到几毫秒。索引是性能调优的利器，但要权衡维护成本和写入性能。"`
        },
        {
          prompt: `Alice: "现在创建覆盖索引（Covering Index）来优化这个频繁运行的查询。覆盖索引包含查询所需的所有列，避免回表查询。"

执行以下操作：
1. 创建一个复合索引 idx_ch15_citizens_covering，包含 citizens 表的 district_id、salary（降序）、name、job 列，适合查询：SELECT name, salary, job FROM citizens WHERE district_id = 1 ORDER BY salary DESC
2. 用 EXPLAIN 验证优化器使用了这个新索引`,
          answerSql: `CREATE INDEX idx_ch15_citizens_covering ON citizens (district_id, salary DESC, name, job);
EXPLAIN SELECT name, salary, job FROM citizens WHERE district_id = 1 ORDER BY salary DESC;`,
          checkSql: `SELECT indexname FROM pg_indexes WHERE tablename = 'citizens' AND indexname = 'idx_ch15_citizens_covering';`,
          needsTransaction: true,
          hints: [
            `复合索引包含多列，列顺序很重要——等值查询列在前，范围查询列在后`,
            `覆盖索引包含 SELECT 需要的所有列，避免回表（Index Only Scan）`,
            `CREATE INDEX idx_ch15_citizens_covering ON citizens (district_id, salary DESC, name, job);
EXPLAIN SELECT name, salary, job FROM citizens WHERE district_id = 1 ORDER BY salary DESC;`
          ],
          successStory: `ZERO: "完美！这个覆盖索引让查询完全走索引扫描，无需回表读取数据行。在大型生产数据库中，覆盖索引可以将查询性能提升 10 倍以上。注意索引的列顺序：district_id 用于等值过滤（WHERE district_id = 1），salary DESC 用于排序（ORDER BY salary DESC），name 和 job 是 SELECT 需要的额外列。这正是索引设计的最佳实践！"`
        }
      ]
    },
    {
      id: 'ch15-3',
      title: '锁等待',
      description: `Alice: "有用户报告查询卡住无响应。这可能是锁等待导致的——某个事务持有锁不放，其他事务只能等待。我们需要查看 pg_locks 和 pg_stat_activity 来诊断问题。"`,
      initSql: FULL_WORLD_ALL_SQL,
      defaultSql: `SELECT locktype, relation::regclass, mode, granted FROM pg_locks WHERE relation IS NOT NULL ORDER BY locktype, relation::regclass;`,
      tasks: [
        {
          prompt: `Alice: "诊断锁问题的第一步是查看 pg_locks 视图。它显示了当前所有的锁信息。"

查询 pg_locks 视图，查看当前持有的锁：
- 显示 locktype、relation（转换为表名）、mode、granted 字段
- 只显示有 relation 的锁（排除虚拟锁）
- 按 locktype 和 relation 排序`,
          answerSql: `SELECT locktype, relation::regclass, mode, granted FROM pg_locks WHERE relation IS NOT NULL ORDER BY locktype, relation::regclass;`,
          hints: [
            `pg_locks 显示当前数据库中的所有锁`,
            `::regclass 将 OID 转换为可读的对象名（如表名）`,
            `SELECT locktype, relation::regclass, mode, granted FROM pg_locks WHERE relation IS NOT NULL ORDER BY locktype, relation::regclass;`
          ],
          successStory: `Alice: "pg_locks 显示了当前系统中的锁状态。在 PGlite 单连接模式下，我们只能看到当前会话的锁。在真实的多连接 PostgreSQL 中，你能看到多个会话之间的锁关系——哪些是 granted（已授予），哪些是 waiting（等待中）。这些锁是并发控制的基石，防止数据不一致。"`
        },
        {
          prompt: `Alice: "现在查看 pg_stat_activity，它显示了每个后端进程的当前活动状态。这是诊断慢查询和锁等待的关键视图。"

查询 pg_stat_activity：
- 显示 datname（数据库名）、state（状态）、query（查询文本）、wait_event_type、wait_event 字段
- 只显示有数据库名的行
- 按 state 排序`,
          answerSql: `SELECT datname, state, query, wait_event_type, wait_event FROM pg_stat_activity WHERE datname IS NOT NULL ORDER BY state;`,
          hints: [
            `pg_stat_activity 显示所有活动连接的状态`,
            `state 可以是 active（正在执行）、idle（空闲）、idle in transaction（事务中空闲）等`,
            `SELECT datname, state, query, wait_event_type, wait_event FROM pg_stat_activity WHERE datname IS NOT NULL ORDER BY state;`
          ],
          successStory: `ZERO: "pg_stat_activity 是 DBA 最常用的诊断视图。它告诉你：谁在连接数据库？他们在执行什么查询？已经执行了多久？是否在等待某个事件？在真实生产环境中，通过这个视图可以快速定位慢查询、锁等待、空闲事务等问题。结合 pg_locks，你可以构建完整的系统健康监控。"`
        }
      ]
    },
    {
      id: 'ch15-4',
      title: '最终对决',
      description: `Mayor Orion: "所有系统同时报警！表膨胀、慢查询、锁等待——所有问题同时爆发！这是最终的考验，ZERO 和 Alice 会全力支持你。拯救城市就靠你了！"

ZERO & Alice: "这是你的最终试炼。运用你所学的全部知识——VACUUM、ANALYZE、索引优化、系统诊断——全面修复这座城市的数据库！"`,
      initSql: FULL_WORLD_ALL_SQL + `
CREATE TABLE diagnostic_events (
  id SERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  severity INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);
INSERT INTO diagnostic_events (event_type, severity)
SELECT 
  CASE (g % 4) WHEN 0 THEN 'system' WHEN 1 THEN 'security' WHEN 2 THEN 'network' ELSE 'database' END,
  (g % 5) + 1
FROM generate_series(1, 100) AS g;`,
      defaultSql: `SELECT relname, n_live_tup, n_dead_tup FROM pg_stat_user_tables ORDER BY n_dead_tup DESC;`,
      tasks: [
        {
          prompt: `【任务 1/4：诊断表膨胀】

Alice: "首先诊断哪些表有膨胀问题。编写一个综合查询，显示所有用户表的死元组情况，并标注健康状态。"

查询 pg_stat_user_tables，显示：
- relname（表名）
- n_live_tup（活元组数）
- n_dead_tup（死元组数）
- bloat_status：如果死元组 > 活元组则为 'CRITICAL'，死元组 > 0 则为 'WARNING'，否则为 'OK'
- 按 n_dead_tup 降序排列`,
          answerSql: `SELECT relname, n_live_tup, n_dead_tup, CASE WHEN n_dead_tup > n_live_tup THEN 'CRITICAL' WHEN n_dead_tup > 0 THEN 'WARNING' ELSE 'OK' END AS bloat_status FROM pg_stat_user_tables ORDER BY n_dead_tup DESC;`,
          hints: [
            `使用 CASE WHEN ... THEN ... WHEN ... THEN ... ELSE ... END 实现条件判断`,
            `CRITICAL > WARNING > OK 的优先级顺序`,
            `SELECT relname, n_live_tup, n_dead_tup, CASE WHEN n_dead_tup > n_live_tup THEN 'CRITICAL' WHEN n_dead_tup > 0 THEN 'WARNING' ELSE 'OK' END AS bloat_status FROM pg_stat_user_tables ORDER BY n_dead_tup DESC;`
          ],
          successStory: `ZERO: "诊断完成！通过 pg_stat_user_tables 我们可以看到哪些表需要 VACUUM。那些标记为 CRITICAL 的表死元组数超过了活元组数，这是最紧急需要处理的情况。现在我们知道了问题的范围，可以继续修复了。"`
        },
        {
          prompt: `【任务 2/4：创建关键索引】

Alice: "crime_records 表经常被按区和严重程度查询，但目前没有合适的索引。创建这个战略索引！"

执行以下操作：
1. 在 crime_records 表上创建复合索引 idx_crime_district_severity，包含 district_id 和 severity 列
2. 用 EXPLAIN 验证查询 SELECT * FROM crime_records WHERE district_id = 1 AND severity > 3 会使用该索引`,
          answerSql: `CREATE INDEX idx_crime_district_severity ON crime_records (district_id, severity);
EXPLAIN SELECT * FROM crime_records WHERE district_id = 1 AND severity > 3;`,
          checkSql: `SELECT indexname FROM pg_indexes WHERE tablename = 'crime_records' AND indexname = 'idx_crime_district_severity';`,
          needsTransaction: true,
          hints: [
            `复合索引的列顺序很重要：等值查询列（district_id）在前，范围查询列（severity）在后`,
            `CREATE INDEX 索引名 ON 表名 (列1, 列2); 创建复合索引`,
            `CREATE INDEX idx_crime_district_severity ON crime_records (district_id, severity);
EXPLAIN SELECT * FROM crime_records WHERE district_id = 1 AND severity > 3;`
          ],
          successStory: `Alice: "索引创建成功！现在 crime_records 表有了针对 district_id + severity 查询的优化路径。对于经常用于 WHERE 条件的列组合，复合索引是最有效的优化手段。这个索引将显著加速犯罪记录的统计分析查询。"`
        },
        {
          prompt: `【任务 3/4：清理与优化】

ZERO: "现在执行全面的清理操作。VACUUM ANALYZE 是最常用的维护命令组合。"

执行以下操作：
1. VACUUM ANALYZE citizens 表
2. VACUUM ANALYZE transactions 表
3. VACUUM ANALYZE crime_records 表
4. 查询 pg_stat_user_tables，显示这三个表的 live/dead 元组统计`,
          answerSql: `VACUUM ANALYZE citizens;
VACUUM ANALYZE transactions;
VACUUM ANALYZE crime_records;
SELECT relname, n_live_tup, n_dead_tup FROM pg_stat_user_tables WHERE relname IN ('citizens', 'transactions', 'crime_records') ORDER BY relname;`,
          checkSql: `SELECT 1 AS optimized;`,
          needsTransaction: true,
          hints: [
            `VACUUM ANALYZE 是 VACUUM 和 ANALYZE 的组合，清理死元组并更新统计信息`,
            `关键业务表应该定期执行 VACUUM ANALYZE`,
            `VACUUM ANALYZE citizens;
VACUUM ANALYZE transactions;
VACUUM ANALYZE crime_records;
SELECT relname, n_live_tup, n_dead_tup FROM pg_stat_user_tables WHERE relname IN ('citizens', 'transactions', 'crime_records') ORDER BY relname;`
          ],
          successStory: `ZERO: "优化完成！三个核心表已完成清理和统计更新。VACUUM ANALYZE 是日常维护的黄金标准——VACUUM 清理死元组释放空间，ANALYZE 更新统计信息让优化器做出更好的决策。在 PostgreSQL 生产环境中，通常由 autovacuum 自动完成这些工作，但作为 DBA，你始终需要掌握手动执行的能力。"`
        },
        {
          prompt: `【任务 4/4：最终系统健康检查】

Mayor Orion: "最后的验证！证明所有问题都已解决！"

Alice & ZERO: "执行一个综合的系统健康检查，展示你的修复成果。"

执行以下查询显示系统状态：
- 查询 pg_stat_user_tables 中死元组数最多的前 5 个表，显示表名和死元组数`,
          answerSql: `SELECT relname, n_dead_tup FROM pg_stat_user_tables ORDER BY n_dead_tup DESC LIMIT 5;`,
          hints: [
            `这是最后的验证查询，确认系统已恢复健康`,
            `LIMIT 5 限制只显示前 5 条结果`,
            `SELECT relname, n_dead_tup FROM pg_stat_user_tables ORDER BY n_dead_tup DESC LIMIT 5;`
          ],
          successStory: `🏆 **FINAL VICTORY - 终极胜利** 🏆

*系统的警报声渐渐平息，屏幕上的红色警告一个个消失，取而代之的是清新的绿色状态指示。*

**Mayor Orion**（激动地握住你的手）："你做到了！你真的做到了！这座城市的数据库系统——我视若珍宝的数字心脏——在你手中重获新生！"

**Alice**（眼中闪烁着光芒）："从第一章的基础 SELECT 查询，到如今能够诊断和修复复杂的数据库危机……看着你一步步成长，是我作为 AI 助手最大的荣幸。你现在已经掌握了：

✨ 数据查询的艺术（Ch1-4）
✨ 数据定义与操作（Ch5-6）
✨ 表结构设计与约束（Ch7）
✨ 索引与 B+ Tree 原理（Ch8）
✨ MVCC 并发控制（Ch9）
✨ WAL 与数据持久化（Ch10）
✨ 查询优化器（Ch11）
✨ 安全与权限（Ch12）
✨ 以及终章的全面诊断与调优

你是一位真正的 PostgreSQL 大师了！"

**ZERO**（难得地露出微笑）："我承认，最初我对人类学习数据库持怀疑态度。但你证明了，只要有决心和正确的指导，任何人都能掌握这些复杂的概念。你不仅学会了 SQL 语法，更理解了 PostgreSQL 的底层原理——从存储引擎到并发控制，从查询优化到系统管理。"

*城市的灯光重新亮起，所有系统的仪表盘都显示着健康的绿色。*

**Mayor Orion**："从今天起，你不仅是这座城市的正式数据库管理员，更是我们所有人的技术导师。ZERO 和 Alice 会继续协助你，但你是这个系统的守护者。"

**Alice & ZERO**（异口同声）："恭喜你完成《PostgreSQL 探秘：从零到大师》的全部旅程！愿数据与你同在！"

🎮 **游戏通关！你已掌握 PostgreSQL 的核心技能！** 🎮

*感谢你的游玩，愿你在真实的数据库世界中继续探索，成为更出色的数据工程师！*`
        }
      ]
    }
  ]
}
