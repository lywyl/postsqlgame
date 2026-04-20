// TODO: 未启用章节，章节 ID 需重新编号后才能接入 chapters.ts
import type { Chapter } from '../../types'
import { FULL_WORLD_WITH_BUILDINGS_SQL } from '../world/init'

export const ch11: Chapter = {
  id: 'ch11',
  title: '第 11 章：加速引擎',
  description: '查询优化器：EXPLAIN / 扫描方式 / JOIN 策略 / 统计信息 / 优化器干预',
  icon: '⚡',
  levels: [
    {
      id: 'ch11-1',
      title: '读懂计划',
      description: 'ZERO: "城市的数据库越来越慢了。Alice 让我调查原因，但我发现问题的根源不是硬件——而是查询本身。优化器在默默工作，但它的决策逻辑对大多数人来说是个黑盒。今天，我要教你如何读懂它的语言。"',
      initSql: FULL_WORLD_WITH_BUILDINGS_SQL,
      defaultSql: "EXPLAIN SELECT * FROM citizens WHERE salary > 20000;",
      tasks: [
        {
          prompt: `ZERO: "优化器是 PostgreSQL 的大脑。每当你执行查询，它都会生成一个执行计划——就像一张路线图，告诉引擎如何获取数据。EXPLAIN 命令就是查看这张地图的窗口。"

使用 EXPLAIN 查看查询计划：查询 citizens 表中 salary > 20000 的所有行。观察输出中的节点类型（如 Seq Scan）、成本估计（cost）和预计行数（rows）。`,
          answerSql: "EXPLAIN SELECT * FROM citizens WHERE salary > 20000;",
          hints: [
            'EXPLAIN 放在 SELECT 前面即可查看执行计划，不会真正执行查询',
            '关注输出中的 Seq Scan（顺序扫描）、cost=0.00..X.XX（启动成本和总成本）、rows=N（预计返回行数）',
            "EXPLAIN SELECT * FROM citizens WHERE salary > 20000;"
          ],
          successStory: 'ZERO: "看到了吗？优化器选择了 Seq Scan（顺序扫描）——因为没有合适的索引，它不得不逐行检查所有 60 条记录。cost=0.00..2.75 表示预计总成本是 2.75 个任意单位，rows=12 是优化器估计会返回的行数。这些数字是优化器的预测，不是实际执行结果。"'
        },
        {
          prompt: `ZERO: "EXPLAIN 只显示计划，不执行查询。要看到真实的执行时间和实际返回行数，需要用 EXPLAIN ANALYZE——它会真正执行查询并收集统计信息。"

使用 EXPLAIN ANALYZE 执行以下查询：按 district_name 分组统计每个区的居民数量，并按数量降序排列。观察实际执行时间（Execution Time）和实际行数（actual rows）与估计值（rows）的差异。`,
          answerSql: "EXPLAIN ANALYZE SELECT d.district_name, COUNT(*) FROM citizens c JOIN districts d ON c.district_id = d.id GROUP BY d.district_name ORDER BY COUNT(*) DESC;",
          hints: [
            'EXPLAIN ANALYZE 会真正执行查询，所以如果是 UPDATE/DELETE 要小心',
            '关注 Execution Time（实际执行时间，毫秒）、actual rows（实际行数）与 plan rows（估计行数）的对比',
            "EXPLAIN ANALYZE SELECT d.district_name, COUNT(*) FROM citizens c JOIN districts d ON c.district_id = d.id GROUP BY d.district_name ORDER BY COUNT(*) DESC;"
          ],
          successStory: 'ZERO: "现在你能看到完整的执行画像：Hash Join 用于连接两表，HashAggregate 用于分组，Sort 用于排序。最关键的是 Execution Time——这是查询真正花费的时间。如果 estimated rows 和 actual rows 差距很大，说明统计信息可能过时了，需要 ANALYZE 更新。读懂执行计划，是性能调优的第一步。"'
        }
      ]
    },
    {
      id: 'ch11-2',
      title: '扫描方式',
      description: 'ZERO: "同样的查询，不同的扫描方式，性能天差地别。顺序扫描像翻书，索引扫描像查目录。理解优化器何时选择哪种扫描，是提速的关键。"',
      initSql: FULL_WORLD_WITH_BUILDINGS_SQL,
      defaultSql: "EXPLAIN ANALYZE SELECT * FROM citizens WHERE salary > 20000;",
      tasks: [
        {
          prompt: `ZERO: "现在 citizens 表没有 salary 索引，查询只能走 Seq Scan。让我演示索引的威力——先查看无索引时的计划，然后创建索引，再对比。"

执行以下操作：
1. 先用 EXPLAIN ANALYZE 查看 SELECT * FROM citizens WHERE salary > 20000 的计划（注意 Seq Scan）
2. 创建索引：CREATE INDEX idx_citizens_salary ON citizens (salary)
3. 再次用 EXPLAIN ANALYZE 查看同一查询的计划（注意变成 Index Scan）`,
          answerSql: `EXPLAIN ANALYZE SELECT * FROM citizens WHERE salary > 20000;
CREATE INDEX idx_citizens_salary ON citizens (salary);
EXPLAIN ANALYZE SELECT * FROM citizens WHERE salary > 20000;`,
          checkSql: "SELECT indexname FROM pg_indexes WHERE tablename = 'citizens' AND indexname = 'idx_citizens_salary';",
          needsTransaction: true,
          hints: [
            '多语句用分号分隔，CREATE INDEX 会修改数据库状态，需要 checkSql 验证',
            '对比两次 EXPLAIN ANALYZE 的输出：第一次是 Seq Scan，第二次应该是 Index Scan 或 Bitmap Index Scan',
            `EXPLAIN ANALYZE SELECT * FROM citizens WHERE salary > 20000;
CREATE INDEX idx_citizens_salary ON citizens (salary);
EXPLAIN ANALYZE SELECT * FROM citizens WHERE salary > 20000;`
          ],
          successStory: 'ZERO: "看到变化了吗？创建索引后，优化器选择了 Index Scan——它直接跳到 salary > 20000 的位置，而不是扫描全表。注意成本（cost）和执行时间（Execution Time）应该都有明显下降。但索引不是万能的：如果查询要返回大部分行，Seq Scan 反而更快——因为随机 IO 比顺序 IO 慢。"'
        },
        {
          prompt: `ZERO: "district_id 是外键，经常用于关联查询。给它建索引，观察 JOIN 查询的计划变化。"

执行以下操作：
1. 先用 EXPLAIN 查看 SELECT * FROM citizens WHERE district_id = 1 的计划
2. 创建索引：CREATE INDEX idx_citizens_district ON citizens (district_id)
3. 再次用 EXPLAIN 查看同一查询的计划`,
          answerSql: `EXPLAIN SELECT * FROM citizens WHERE district_id = 1;
CREATE INDEX idx_citizens_district ON citizens (district_id);
EXPLAIN SELECT * FROM citizens WHERE district_id = 1;`,
          checkSql: "SELECT indexname FROM pg_indexes WHERE tablename = 'citizens' AND indexname = 'idx_citizens_district';",
          needsTransaction: true,
          hints: [
            '外键列通常应该建索引，因为 JOIN 查询会频繁使用它们',
            '对比两次 EXPLAIN 的输出，注意扫描方式的变化',
            `EXPLAIN SELECT * FROM citizens WHERE district_id = 1;
CREATE INDEX idx_citizens_district ON citizens (district_id);
EXPLAIN SELECT * FROM citizens WHERE district_id = 1;`
          ],
          successStory: 'ZERO: "district_id 索引已就位。现在按区查询居民会走索引扫描，JOIN 操作也会受益。记住：索引加速读取，但拖慢写入——每次 INSERT/UPDATE/DELETE 都要维护索引。所以索引要精不要多，只在频繁查询的列上建索引。"'
        }
      ]
    },
    {
      id: 'ch11-3',
      title: 'JOIN 策略',
      description: 'ZERO: "多表 JOIN 是数据库的核心操作，但实现方式有三种：Nested Loop（嵌套循环）、Hash Join（哈希连接）、Merge Join（归并连接）。优化器会根据数据特征自动选择，但你可以通过配置观察它们的行为。"',
      initSql: FULL_WORLD_WITH_BUILDINGS_SQL,
      defaultSql: "EXPLAIN SELECT c.name, d.district_name FROM citizens c JOIN districts d ON c.district_id = d.id;",
      tasks: [
        {
          prompt: `ZERO: "观察优化器为 citizens 和 districts 的 JOIN 选择了什么策略。默认情况下，小表 JOIN 大表时优化器通常选择 Hash Join。"

使用 EXPLAIN 查看以下查询的计划：SELECT c.name, d.district_name FROM citizens c JOIN districts d ON c.district_id = d.id。注意输出中的 Join 类型（如 Hash Join）。`,
          answerSql: "EXPLAIN SELECT c.name, d.district_name FROM citizens c JOIN districts d ON c.district_id = d.id;",
          hints: [
            '关注 EXPLAIN 输出中的 Join 类型：Hash Join、Nested Loop 或 Merge Join',
            'Hash Join 通常用于中等数据量，先对小表建哈希表，再扫描大表匹配',
            "EXPLAIN SELECT c.name, d.district_name FROM citizens c JOIN districts d ON c.district_id = d.id;"
          ],
          successStory: 'ZERO: "优化器选择了 Hash Join——这是最优策略：先对 districts 表（8行）建哈希表，然后扫描 citizens 表（60行），用哈希查找匹配 district_id。Hash Join 的时间复杂度接近 O(N+M)，是大数据量 JOIN 的首选。但优化器的选择基于统计信息，如果统计不准，它可能选错。"'
        },
        {
          prompt: `ZERO: "你可以通过配置参数强制优化器使用特定的 JOIN 策略。这是调试和性能测试的重要手段——看看查询在其他策略下的表现。"

执行以下操作：
1. 关闭 Hash Join：SET enable_hashjoin = off
2. 用 EXPLAIN 查看同样的 JOIN 查询计划（注意 Join 类型变化）
3. 恢复 Hash Join：SET enable_hashjoin = on`,
          answerSql: `SET enable_hashjoin = off;
EXPLAIN SELECT c.name, d.district_name FROM citizens c JOIN districts d ON c.district_id = d.id;
SET enable_hashjoin = on;`,
          checkSql: "SELECT 1 AS config_test;",
          needsTransaction: true,
          hints: [
            'SET 命令可以修改会话级配置参数，enable_hashjoin 控制是否允许 Hash Join',
            '关闭 Hash Join 后，优化器会退而求其次选择 Nested Loop 或 Merge Join',
            `SET enable_hashjoin = off;
EXPLAIN SELECT c.name, d.district_name FROM citizens c JOIN districts d ON c.district_id = d.id;
SET enable_hashjoin = on;`
          ],
          successStory: 'ZERO: "看到变化了吗？关闭 Hash Join 后，优化器选择了 Nested Loop——对外层表的每一行，都去内层表扫描匹配。对于小数据量这没问题，但数据量大时性能会暴跌。类似的开关还有 enable_nestloop、enable_mergejoin、enable_seqscan 等。这些参数是调试利器，但生产环境慎用——它们会全局影响优化器决策。"'
        }
      ]
    },
    {
      id: 'ch11-4',
      title: '统计信息',
      description: 'ZERO: "优化器不是先知——它靠统计信息做决策。表有多大？列有多少唯一值？数据分布如何？ANALYZE 命令负责收集这些信息，pg_stats 视图存储着答案。统计信息不准，优化器就会像盲人摸象。"',
      initSql: FULL_WORLD_WITH_BUILDINGS_SQL,
      defaultSql: "ANALYZE citizens;",
      tasks: [
        {
          prompt: `ZERO: "ANALYZE 命令扫描表并收集统计信息，供优化器使用。没有准确的统计，优化器就无法估算成本，可能做出错误决策。"

执行以下操作：
1. 对 citizens 表运行 ANALYZE 收集统计信息
2. 查询 pg_stats 视图，查看 citizens 表 salary 列的统计信息：null_frac（空值比例）、avg_width（平均宽度）、n_distinct（唯一值数量）、most_common_vals（最常见值）、histogram_bounds（直方图边界）`,
          answerSql: `ANALYZE citizens;
SELECT null_frac, avg_width, n_distinct, most_common_vals, histogram_bounds
FROM pg_stats
WHERE tablename = 'citizens' AND attname = 'salary';`,
          checkSql: "SELECT 1 AS analyzed;",
          needsTransaction: true,
          hints: [
            'ANALYZE 表名; 收集该表的统计信息，不阻塞读写',
            'pg_stats 是系统视图，存储所有表的列级统计信息',
            `ANALYZE citizens;
SELECT null_frac, avg_width, n_distinct, most_common_vals, histogram_bounds
FROM pg_stats
WHERE tablename = 'citizens' AND attname = 'salary';`
          ],
          successStory: 'ZERO: "统计信息收集完成。n_distinct 告诉你 salary 列有多少唯一值，most_common_vals 列出最常见的几个值及其频率，histogram_bounds 是数据分布的直方图边界。优化器用这些信息估算 WHERE salary > 20000 会返回多少行——这个估算直接影响 Join 策略和扫描方式的选择。"'
        },
        {
          prompt: `ZERO: "district_id 是外键，它的统计信息决定了 JOIN 的代价估算。让我们看看它的数据分布。"

查询 pg_stats 视图，查看 citizens 表 district_id 列的统计信息：null_frac、n_distinct、most_common_vals、most_common_freqs（最常见值的频率）。`,
          answerSql: `SELECT null_frac, n_distinct, most_common_vals, most_common_freqs
FROM pg_stats
WHERE tablename = 'citizens' AND attname = 'district_id';`,
          hints: [
            'most_common_freqs 显示最常见值的出现频率，帮助优化器估算选择性',
            'n_distinct 为负数时表示唯一值比例（如 -0.5 表示约 50% 的唯一值）',
            `SELECT null_frac, n_distinct, most_common_vals, most_common_freqs
FROM pg_stats
WHERE tablename = 'citizens' AND attname = 'district_id';`
          ],
          successStory: 'ZERO: "district_id 的统计信息揭示了数据分布：哪些区居民最多，每个区占比多少。优化器用这些频率估算 JOIN 的中间结果大小——如果它以为 JOIN 会产生 1000 行，实际只有 10 行，就可能选错 Join 策略。定期运行 ANALYZE（或依赖 autovacuum）是保持性能的关键。"'
        }
      ]
    },
    {
      id: 'ch11-5',
      title: '强制干预',
      description: 'ZERO: "优化器偶尔会犯错——统计信息不准、数据分布特殊、或者就是选错了策略。作为 DBA，你需要知道如何干预：临时禁用某些扫描方式，或者使用优化器提示。这是最后的手段，但也是必备的技能。"',
      initSql: FULL_WORLD_WITH_BUILDINGS_SQL,
      defaultSql: "CREATE INDEX idx_citizens_salary ON citizens (salary);",
      tasks: [
        {
          prompt: `ZERO: "有时候优化器坚持要用 Seq Scan，但你知道 Index Scan 更快。SET enable_seqscan = off 可以强制优化器考虑索引——这是验证索引效果的常用手段。"

执行以下操作：
1. 先创建 salary 索引（如果还没有）：CREATE INDEX idx_citizens_salary ON citizens (salary)
2. 关闭顺序扫描：SET enable_seqscan = off
3. 用 EXPLAIN 查看 SELECT * FROM citizens WHERE salary > 20000 的计划（应该变成 Index Scan）
4. 恢复顺序扫描：SET enable_seqscan = on`,
          answerSql: `CREATE INDEX idx_citizens_salary ON citizens (salary);
SET enable_seqscan = off;
EXPLAIN SELECT * FROM citizens WHERE salary > 20000;
SET enable_seqscan = on;`,
          checkSql: "SELECT indexname FROM pg_indexes WHERE tablename = 'citizens' AND indexname = 'idx_citizens_salary';",
          needsTransaction: true,
          hints: [
            'enable_seqscan = off 强制优化器使用索引，但只是会话级设置',
            '最后记得恢复 enable_seqscan = on，否则影响后续查询',
            `CREATE INDEX idx_citizens_salary ON citizens (salary);
SET enable_seqscan = off;
EXPLAIN SELECT * FROM citizens WHERE salary > 20000;
SET enable_seqscan = on;`
          ],
          successStory: 'ZERO: "看到 Index Scan 了吗？关闭 Seq Scan 后，优化器被迫使用索引。这证明了索引是有效的——如果强制索引后成本反而上升，说明这个查询不适合走索引（比如返回行数太多）。enable_seqscan 是调试利器，但不要在生产环境长期关闭它——优化器通常比你更懂数据分布。"'
        },
        {
          prompt: `ZERO: "复合索引可以同时加速多条件查询。让我们创建一个 (district_id, salary) 的复合索引，然后观察它对不同查询的影响。"

执行以下操作：
1. 创建复合索引：CREATE INDEX idx_citizens_district_salary ON citizens (district_id, salary)
2. 用 EXPLAIN 查看 SELECT * FROM citizens WHERE district_id = 1 AND salary > 15000 的计划
3. 查询 pg_indexes 确认索引已创建`,
          answerSql: `CREATE INDEX idx_citizens_district_salary ON citizens (district_id, salary);
EXPLAIN SELECT * FROM citizens WHERE district_id = 1 AND salary > 15000;
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'citizens' AND indexname = 'idx_citizens_district_salary';`,
          checkSql: "SELECT indexname FROM pg_indexes WHERE tablename = 'citizens' AND indexname = 'idx_citizens_district_salary';",
          needsTransaction: true,
          hints: [
            '复合索引 (A, B) 可以加速 WHERE A = ? AND B = ?，也可以加速 WHERE A = ?（最左前缀）',
            '但不能加速单独的 WHERE B = ?，因为不符合最左前缀原则',
            `CREATE INDEX idx_citizens_district_salary ON citizens (district_id, salary);
EXPLAIN SELECT * FROM citizens WHERE district_id = 1 AND salary > 15000;
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'citizens' AND indexname = 'idx_citizens_district_salary';`
          ],
          successStory: 'ZERO: "复合索引生效了！优化器使用了 Index Scan，利用 (district_id, salary) 索引直接定位到 district_id = 1 且 salary > 15000 的行。复合索引的列顺序至关重要——(district_id, salary) 能加速 district_id 的等值查询，但反过来 (salary, district_id) 对 district_id = 1 的查询就没那么高效。从读懂执行计划到理解扫描方式，从 JOIN 策略到统计信息，再到强制干预——你已经掌握了 PostgreSQL 查询优化的核心技能。这座城市的数据库，将在你的调优下重获新生。"'
        }
      ]
    }
  ]
}
