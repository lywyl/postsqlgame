import type { Chapter } from '../../types'
import { FULL_WORLD_WITH_BUILDINGS_SQL } from '../world/init'

export const ch7: Chapter = {
  id: 'ch7',
  title: '第 7 章：时间裂缝',
  description: 'MVCC 与持久化：系统列 / 版本链 / 事务控制 / 隔离级别 / VACUUM / WAL / 检查点',
  icon: '⏳',
  levels: [
    {
      id: 'ch7-1',
      title: '元组幽灵',
      description: 'ZERO: "你以为删除就是消失？在 PostgreSQL 的世界里，没有什么会真正消失——每一行数据都携带着时间戳记，记录着它何时诞生、何时死亡。这些隐藏的系统列，就是通往时间裂缝的钥匙。"',
      initSql: FULL_WORLD_WITH_BUILDINGS_SQL,
      defaultSql: "SELECT xmin, xmax, ctid, id, name, salary\nFROM citizens\nWHERE id <= 5\nORDER BY id;",
      mvccScenario: {
        tableName: 'citizens',
        columns: ['id', 'name', 'salary'],
        initialRows: [
          { id: 1, name: '张伟', salary: 15000 },
          { id: 2, name: '李娜', salary: 22000 },
          { id: 3, name: '王芳', salary: 18000 }
        ],
        operations: [
          {
            op: 'INSERT',
            data: { id: 99, name: '幽灵进程', salary: 0 },
            explanation: 'INSERT 创建新元组，xmin 设为当前事务 ID，xmax 为 0（表示"活着"）'
          },
          {
            op: 'DELETE',
            target: { id: 99 },
            explanation: 'DELETE 不会物理删除行，而是将 xmax 设为当前事务 ID——标记为"已死亡"'
          },
          {
            op: 'VACUUM',
            explanation: 'VACUUM 清理所有 xmax 已提交的死元组，回收物理空间'
          }
        ]
      },
      tasks: [
        {
          prompt: '📋 数据参考：表 citizens (id, name, age, district_id, job, salary) — 系统列：xmin, xmax, ctid\n\nZERO: "每一行数据都有三个隐藏的系统列：xmin（创建该行的事务 ID）、xmax（删除/更新该行的事务 ID，0 表示活着）、ctid（物理位置，格式为 (页号,行号)）。这些是 MVCC 的基石。"\n\n查询 citizens 表前 5 行的系统列信息：选择 xmin, xmax, ctid, id, name, salary，按 id 排序。',
          answerSql: "SELECT xmin, xmax, ctid, id, name, salary\nFROM citizens\nWHERE id <= 5\nORDER BY id;",
          hints: [
            'xmin, xmax, ctid 是 PostgreSQL 的隐藏系统列，可以直接在 SELECT 中引用',
            '语法和普通列完全一样：SELECT xmin, xmax, ctid, 其他列 FROM 表名',
            "SELECT xmin, xmax, ctid, id, name, salary\nFROM citizens\nWHERE id <= 5\nORDER BY id;"
          ],
          successStory: 'ZERO: "看到了吗？每一行都有 xmin——它就是创建这行数据的事务编号。xmax 为 0 表示这行还活着，没有被任何事务删除或更新。ctid 是物理地址，(0,1) 表示第 0 页第 1 行。这些隐藏信息，就是 PostgreSQL 实现多版本并发控制的秘密。"'
        },
        {
          prompt: '📋 数据参考：表 citizens (id, name, age, district_id, job, salary) — 系统列：xmin, xmax, ctid\n\nZERO: "现在做个实验——删除 id=5 的居民，然后立刻查看系统列。你会发现……被删除的行并没有消失。"\n\n执行以下操作：\n1. 删除 citizens 表中 id = 5 的行\n2. 然后查询 id <= 5 的行的 xmin, xmax, ctid, id, name\n\n注意：删除后该行在普通查询中不可见，但我们可以通过观察剩余行的系统列来理解 MVCC 的工作方式。',
          answerSql: "DELETE FROM citizens WHERE id = 5;\nSELECT xmin, xmax, ctid, id, name\nFROM citizens\nWHERE id <= 5\nORDER BY id;",
          checkSql: "SELECT count(*) AS remaining FROM citizens WHERE id <= 5;",
          needsTransaction: true,
          hints: [
            'DELETE 在 MVCC 中不会物理删除行，而是将 xmax 标记为当前事务 ID',
            '先执行 DELETE，再执行 SELECT 查看结果——两条语句用分号分隔',
            "DELETE FROM citizens WHERE id = 5;\nSELECT xmin, xmax, ctid, id, name\nFROM citizens\nWHERE id <= 5\nORDER BY id;"
          ],
          successStory: 'ZERO: "id=5 的行从结果中消失了——但在磁盘上，它还躺在那里，只是 xmax 被标记了。这就是 MVCC 的核心：删除不是擦除，而是标记死亡时间。其他正在运行的事务如果开始得更早，仍然可以看到这行数据。这就是时间裂缝的本质。"'
        }
      ]
    },
    {
      id: 'ch7-2',
      title: '版本追踪',
      description: 'ZERO: "在 PostgreSQL 中，UPDATE 不是原地修改——它是先把旧行标记为死亡（设置 xmax），再插入一个全新的行。每次更新都会产生一个新版本，旧版本变成幽灵。这就是版本链。"',
      initSql: FULL_WORLD_WITH_BUILDINGS_SQL + `
CREATE TABLE mvcc_lab (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  value INTEGER NOT NULL
);
INSERT INTO mvcc_lab VALUES (1, '实验体-A', 100), (2, '实验体-B', 200), (3, '实验体-C', 300);
`,
      defaultSql: "SELECT xmin, xmax, ctid, * FROM mvcc_lab ORDER BY id;",
      mvccScenario: {
        tableName: 'mvcc_lab',
        columns: ['id', 'name', 'value'],
        initialRows: [
          { id: 1, name: '实验体-A', value: 100 },
          { id: 2, name: '实验体-B', value: 200 },
          { id: 3, name: '实验体-C', value: 300 }
        ],
        operations: [
          {
            op: 'UPDATE',
            target: { id: 1 },
            data: { value: 999 },
            explanation: 'UPDATE = 旧元组标记 xmax + 插入新元组。旧版本 (value=100) 死亡，新版本 (value=999) 诞生'
          },
          {
            op: 'UPDATE',
            target: { id: 1 },
            data: { value: 1500 },
            explanation: '再次 UPDATE：又一个版本诞生。版本链：100 → 999 → 1500，前两个都是死元组'
          },
          {
            op: 'VACUUM',
            explanation: 'VACUUM 清理版本链中的死元组，只保留最新的活版本'
          }
        ]
      },
      tasks: [
        {
          prompt: '📋 数据参考：表 mvcc_lab (id, name, value) — 系统列：xmin, xmax, ctid\n\nZERO: "mvcc_lab 表有 3 条记录。先看看它们的初始系统列状态，然后更新 id=1 的 value 为 999，再查看系统列的变化。"\n\n执行以下操作：\n1. 将 mvcc_lab 中 id=1 的 value 更新为 999\n2. 查询 mvcc_lab 的 xmin, xmax, ctid 和所有业务列，按 id 排序\n\n观察 id=1 的行：它的 xmin 和 ctid 是否发生了变化？',
          answerSql: "UPDATE mvcc_lab SET value = 999 WHERE id = 1;\nSELECT xmin, xmax, ctid, * FROM mvcc_lab ORDER BY id;",
          checkSql: "SELECT value FROM mvcc_lab WHERE id = 1;",
          needsTransaction: true,
          hints: [
            'UPDATE 在 MVCC 中等价于 DELETE 旧版本 + INSERT 新版本，所以更新后的行会有新的 xmin 和 ctid',
            '先 UPDATE 再 SELECT，用分号分隔两条语句',
            "UPDATE mvcc_lab SET value = 999 WHERE id = 1;\nSELECT xmin, xmax, ctid, * FROM mvcc_lab ORDER BY id;"
          ],
          successStory: 'ZERO: "注意 id=1 的行——它的 xmin 变了，ctid 也可能变了。这证明 UPDATE 创建了一个全新的物理行。旧行（value=100）还在磁盘上，只是被标记为死亡（xmax 被设置）。这就是 PostgreSQL 的 UPDATE = DELETE + INSERT 机制。"'
        },
        {
          prompt: '📋 数据参考：表 mvcc_lab (id, name, value) — 系统列：xmin, xmax, ctid\n\nZERO: "连续更新同一行会产生版本链。再更新一次 id=1，把 value 改为 1500，然后查看 ctid 的变化——每次更新都会分配新的物理位置。"\n\n1. 将 mvcc_lab 中 id=1 的 value 更新为 1500\n2. 查询所有行的 xmin, xmax, ctid 和业务列，按 id 排序',
          answerSql: "UPDATE mvcc_lab SET value = 1500 WHERE id = 1;\nSELECT xmin, xmax, ctid, * FROM mvcc_lab ORDER BY id;",
          checkSql: "SELECT value FROM mvcc_lab WHERE id = 1;",
          needsTransaction: true,
          hints: [
            '每次 UPDATE 都会产生新版本，旧版本成为死元组——版本链越来越长',
            '和上一个任务模式相同：UPDATE + SELECT',
            "UPDATE mvcc_lab SET value = 1500 WHERE id = 1;\nSELECT xmin, xmax, ctid, * FROM mvcc_lab ORDER BY id;"
          ],
          successStory: 'ZERO: "id=1 现在经历了三个版本：100 → 999 → 1500。每个旧版本都是一个死元组，占据着磁盘空间。这就是为什么频繁更新的表会膨胀——死元组越积越多，直到 VACUUM 来清理它们。版本链是 MVCC 的代价，也是它实现无锁读取的基础。"'
        }
      ]
    },
    {
      id: 'ch7-3',
      title: '事务基础',
      description: 'ZERO: "到目前为止你执行的每条 SQL 都是自动提交的——PostgreSQL 默认把每条语句包在一个隐式事务里。但真正的力量在于显式事务：BEGIN 开启，COMMIT 提交，ROLLBACK 回滚。事务是数据库世界的时间胶囊。"',
      initSql: FULL_WORLD_WITH_BUILDINGS_SQL + `
CREATE TABLE vault (
  id SERIAL PRIMARY KEY,
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity >= 0),
  last_modified TIMESTAMP DEFAULT NOW()
);
INSERT INTO vault (item_name, quantity) VALUES
  ('能量核心', 50),
  ('数据晶片', 200),
  ('防护模块', 30),
  ('通信组件', 100),
  ('修复纳米', 80);
`,
      defaultSql: "BEGIN;\nUPDATE vault SET quantity = quantity - 10 WHERE item_name = '能量核心';\nUPDATE vault SET quantity = quantity + 10 WHERE item_name = '防护模块';\nCOMMIT;\nSELECT * FROM vault ORDER BY id;",
      tasks: [
        {
          prompt: '📋 数据参考：表 vault (id, item_name, quantity, last_modified)\n\nZERO: "vault 表存储着城市的战略物资。现在需要从能量核心中转移 10 个单位到防护模块——这两个操作必须同时成功或同时失败，不能只扣不加。"\n\n使用显式事务完成物资转移：\n1. BEGIN 开启事务\n2. 将能量核心的 quantity 减少 10\n3. 将防护模块的 quantity 增加 10\n4. COMMIT 提交事务\n5. 查询 vault 全表验证结果（按 id 排序）',
          answerSql: "BEGIN;\nUPDATE vault SET quantity = quantity - 10 WHERE item_name = '能量核心';\nUPDATE vault SET quantity = quantity + 10 WHERE item_name = '防护模块';\nCOMMIT;\nSELECT * FROM vault ORDER BY id;",
          checkSql: "SELECT item_name, quantity FROM vault WHERE item_name IN ('能量核心', '防护模块') ORDER BY item_name;",
          needsTransaction: true,
          hints: [
            'BEGIN 开启事务，COMMIT 提交——中间的所有操作要么全部生效，要么全部回滚',
            '事务中可以包含多条 DML 语句，它们作为一个原子单元执行',
            "BEGIN;\nUPDATE vault SET quantity = quantity - 10 WHERE item_name = '能量核心';\nUPDATE vault SET quantity = quantity + 10 WHERE item_name = '防护模块';\nCOMMIT;\nSELECT * FROM vault ORDER BY id;"
          ],
          successStory: 'ZERO: "事务提交成功。能量核心从 50 变成 40，防护模块从 30 变成 40——总量守恒。如果中间任何一步失败，整个事务都会回滚，不会出现只扣不加的情况。这就是事务的原子性（Atomicity）。"'
        },
        {
          prompt: '📋 数据参考：表 vault (id, item_name, quantity, last_modified)\n\nZERO: "如果操作到一半发现搞错了怎么办？ROLLBACK 可以撤销事务中的所有操作，就像什么都没发生过。"\n\n执行以下操作：\n1. BEGIN 开启事务\n2. 删除 vault 中所有 quantity < 50 的物资\n3. ROLLBACK 回滚事务（撤销删除）\n4. 查询 vault 全表确认数据完好（按 id 排序）',
          answerSql: "BEGIN;\nDELETE FROM vault WHERE quantity < 50;\nROLLBACK;\nSELECT * FROM vault ORDER BY id;",
          checkSql: "SELECT count(*) AS total_items FROM vault;",
          needsTransaction: true,
          hints: [
            'ROLLBACK 会撤销 BEGIN 之后的所有操作，数据恢复到事务开始前的状态',
            'BEGIN → 危险操作 → ROLLBACK，数据不会受到任何影响',
            "BEGIN;\nDELETE FROM vault WHERE quantity < 50;\nROLLBACK;\nSELECT * FROM vault ORDER BY id;"
          ],
          successStory: 'ZERO: "所有物资都还在——ROLLBACK 完美撤销了删除操作。在生产环境中，这是你的安全网：先 BEGIN，执行操作，检查结果，确认无误再 COMMIT，发现问题就 ROLLBACK。永远不要在没有事务保护的情况下执行批量修改。"'
        },
        {
          prompt: '📋 数据参考：表 vault (id, item_name, quantity, last_modified)\n\nZERO: "SAVEPOINT 是事务中的存档点——你可以回滚到某个存档点，而不是撤销整个事务。这在复杂操作中非常有用。"\n\n执行以下操作：\n1. BEGIN 开启事务\n2. 将数据晶片的 quantity 更新为 500\n3. SAVEPOINT sp1（创建存档点）\n4. 将通信组件的 quantity 更新为 0\n5. ROLLBACK TO sp1（回滚到存档点，撤销第 4 步）\n6. COMMIT 提交事务\n7. 查询 vault 全表验证：数据晶片应该是 500，通信组件应该不变',
          answerSql: "BEGIN;\nUPDATE vault SET quantity = 500 WHERE item_name = '数据晶片';\nSAVEPOINT sp1;\nUPDATE vault SET quantity = 0 WHERE item_name = '通信组件';\nROLLBACK TO sp1;\nCOMMIT;\nSELECT * FROM vault ORDER BY id;",
          checkSql: "SELECT item_name, quantity FROM vault WHERE item_name IN ('数据晶片', '通信组件') ORDER BY item_name;",
          needsTransaction: true,
          hints: [
            'SAVEPOINT 名称 创建存档点，ROLLBACK TO 名称 回滚到该存档点——存档点之前的操作保留',
            'SAVEPOINT 只在事务内有效，ROLLBACK TO 只撤销存档点之后的操作',
            "BEGIN;\nUPDATE vault SET quantity = 500 WHERE item_name = '数据晶片';\nSAVEPOINT sp1;\nUPDATE vault SET quantity = 0 WHERE item_name = '通信组件';\nROLLBACK TO sp1;\nCOMMIT;\nSELECT * FROM vault ORDER BY id;"
          ],
          successStory: 'ZERO: "数据晶片变成了 500（存档点之前的操作保留），通信组件还是 100（存档点之后的操作被撤销）。SAVEPOINT 就像游戏中的快速存档——你可以大胆尝试，失败了就读档重来，而不用从头开始。BEGIN/COMMIT/ROLLBACK/SAVEPOINT——这四个命令构成了事务控制的完整武器库。"'
        }
      ]
    },
    {
      id: 'ch7-4',
      title: '隔离之争',
      description: 'ZERO: "当两个事务同时操作同一张表，它们看到的数据可能不同——这取决于隔离级别。PostgreSQL 支持三种隔离级别，每种都在一致性和并发性之间做出不同的权衡。虽然 PGlite 是单连接的，但我们可以通过系统配置和模拟来理解这些概念。"',
      initSql: FULL_WORLD_WITH_BUILDINGS_SQL + `
CREATE TABLE isolation_demo (
  id SERIAL PRIMARY KEY,
  account TEXT NOT NULL,
  balance INTEGER NOT NULL
);
INSERT INTO isolation_demo (account, balance) VALUES
  ('Alice-基金', 10000),
  ('ZERO-暗账', 5000),
  ('Orion-金库', 50000);
`,
      defaultSql: "SHOW default_transaction_isolation;",
      tasks: [
        {
          prompt: '📋 数据参考：表 isolation_demo (id, account, balance)\n\nZERO: "PostgreSQL 的默认隔离级别是 READ COMMITTED——每条语句都能看到在它开始执行之前已提交的所有数据。先查看当前的默认隔离级别设置。"\n\n使用 SHOW 命令查看 default_transaction_isolation 的值。',
          answerSql: "SHOW default_transaction_isolation;",
          hints: [
            'SHOW 命令用于查看 PostgreSQL 配置参数的当前值',
            '语法：SHOW 参数名; 不需要引号',
            "SHOW default_transaction_isolation;"
          ],
          successStory: 'ZERO: "read committed——这是 PostgreSQL 的默认隔离级别。在这个级别下，事务中的每条 SELECT 都能看到其他事务在该 SELECT 开始前已提交的修改。这意味着同一个事务中两次相同的 SELECT 可能返回不同结果（如果中间有其他事务提交了修改）。这叫做不可重复读。"'
        },
        {
          prompt: '📋 数据参考：表 isolation_demo (id, account, balance)\n\nZERO: "REPEATABLE READ 级别更严格——事务开始后，无论其他事务怎么修改数据，你看到的始终是事务开始那一刻的快照。来体验一下。"\n\n执行以下操作：\n1. 开启一个 REPEATABLE READ 级别的事务\n2. 查询 isolation_demo 全表（按 id 排序）\n3. 在事务内更新 ZERO-暗账的 balance 为 99999\n4. 再次查询全表查看变化\n5. COMMIT 提交',
          answerSql: "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;\nSELECT * FROM isolation_demo ORDER BY id;\nUPDATE isolation_demo SET balance = 99999 WHERE account = 'ZERO-暗账';\nSELECT * FROM isolation_demo ORDER BY id;\nCOMMIT;",
          checkSql: "SELECT balance FROM isolation_demo WHERE account = 'ZERO-暗账';",
          needsTransaction: true,
          hints: [
            'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ; 开启指定隔离级别的事务',
            '在 REPEATABLE READ 中，事务看到的是开始时的一致性快照——自己的修改当然可见',
            "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;\nSELECT * FROM isolation_demo ORDER BY id;\nUPDATE isolation_demo SET balance = 99999 WHERE account = 'ZERO-暗账';\nSELECT * FROM isolation_demo ORDER BY id;\nCOMMIT;"
          ],
          successStory: 'ZERO: "在 REPEATABLE READ 下，事务拿到的是一个时间点快照。自己的修改当然可见，但其他事务的修改在本事务结束前都不可见。三种隔离级别的权衡：READ COMMITTED 并发最好但一致性最弱，SERIALIZABLE 一致性最强但并发最差，REPEATABLE READ 居中。在实际开发中，大多数场景用默认的 READ COMMITTED 就够了，只有金融级别的操作才需要更高隔离级别。"'
        }
      ]
    },
    {
      id: 'ch7-5',
      title: '空间回收',
      description: 'ZERO: "MVCC 的代价就是死元组——每次 UPDATE 和 DELETE 都会留下尸体。如果没有人清理，表会越来越膨胀，查询越来越慢。VACUUM 就是数据库的垃圾回收器。在生产环境中 autovacuum 会自动运行，但在这里你需要手动操作——这反而让你更深刻地理解它的工作原理。"',
      initSql: FULL_WORLD_WITH_BUILDINGS_SQL + `
CREATE TABLE bloat_test (
  id SERIAL PRIMARY KEY,
  data TEXT NOT NULL,
  counter INTEGER DEFAULT 0
);
INSERT INTO bloat_test (data)
SELECT '测试数据-' || generate_series(1, 100);
`,
      defaultSql: "UPDATE bloat_test SET counter = counter + 1;\nSELECT count(*) AS total_rows FROM bloat_test;",
      mvccScenario: {
        tableName: 'bloat_test',
        columns: ['id', 'data', 'counter'],
        initialRows: [
          { id: 1, data: '测试数据-1', counter: 0 },
          { id: 2, data: '测试数据-2', counter: 0 },
          { id: 3, data: '测试数据-3', counter: 0 }
        ],
        operations: [
          {
            op: 'UPDATE',
            target: { id: 1 },
            data: { counter: 1 },
            explanation: 'UPDATE 产生死元组：旧版本 (counter=0) 死亡，新版本 (counter=1) 诞生'
          },
          {
            op: 'UPDATE',
            target: { id: 2 },
            data: { counter: 1 },
            explanation: '又一个死元组。批量 UPDATE 100 行 = 产生 100 个死元组'
          },
          {
            op: 'VACUUM',
            explanation: 'VACUUM 回收所有死元组的空间，表恢复正常大小'
          }
        ]
      },
      tasks: [
        {
          prompt: '📋 数据参考：表 bloat_test (id, data, counter)\n\nZERO: "bloat_test 表有 100 行数据。现在批量更新所有行，制造 100 个死元组，然后用 pg_stat_user_tables 查看死元组数量。"\n\n执行以下操作：\n1. 将 bloat_test 所有行的 counter 加 1\n2. 查询 pg_stat_user_tables，获取 bloat_test 的 n_live_tup（活元组数）和 n_dead_tup（死元组数）',
          answerSql: "UPDATE bloat_test SET counter = counter + 1;\nSELECT relname, n_live_tup, n_dead_tup\nFROM pg_stat_user_tables\nWHERE relname = 'bloat_test';",
          checkSql: "SELECT n_dead_tup >= 0 AS has_stats FROM pg_stat_user_tables WHERE relname = 'bloat_test';",
          needsTransaction: true,
          hints: [
            'pg_stat_user_tables 是 PostgreSQL 的统计视图，记录每张表的活元组和死元组数量',
            'n_live_tup 是活着的行数，n_dead_tup 是等待 VACUUM 清理的死行数',
            "UPDATE bloat_test SET counter = counter + 1;\nSELECT relname, n_live_tup, n_dead_tup\nFROM pg_stat_user_tables\nWHERE relname = 'bloat_test';"
          ],
          successStory: 'ZERO: "看到 n_dead_tup 了吗？每次 UPDATE 都会产生一个死元组——100 行全部更新就是 100 个死元组。这些死元组占据着磁盘空间，还会拖慢顺序扫描（因为扫描器必须跳过它们）。在生产环境中，autovacuum 会自动清理，但在这里你需要手动出手。"'
        },
        {
          prompt: '📋 数据参考：表 bloat_test (id, data, counter)\n\nZERO: "是时候清理了。执行 VACUUM 回收死元组，然后再次检查统计信息确认清理效果。"\n\n执行以下操作：\n1. 对 bloat_test 执行 VACUUM\n2. 再次查询 pg_stat_user_tables 查看 bloat_test 的 n_live_tup 和 n_dead_tup',
          answerSql: "VACUUM bloat_test;\nSELECT relname, n_live_tup, n_dead_tup\nFROM pg_stat_user_tables\nWHERE relname = 'bloat_test';",
          checkSql: "SELECT 1 AS vacuumed;",
          needsTransaction: true,
          hints: [
            'VACUUM 表名; 清理指定表的死元组，回收空间供该表后续使用',
            'VACUUM 后 n_dead_tup 应该降为 0 或接近 0',
            "VACUUM bloat_test;\nSELECT relname, n_live_tup, n_dead_tup\nFROM pg_stat_user_tables\nWHERE relname = 'bloat_test';"
          ],
          successStory: 'ZERO: "死元组被清理了。VACUUM 做了两件事：1) 标记死元组占用的空间为可复用（但不归还操作系统）；2) 更新可见性映射（Visibility Map）。如果你需要真正缩小表的物理文件大小，需要 VACUUM FULL——但它会锁表，生产环境慎用。"'
        }
      ]
    },
    {
      id: 'ch7-6',
      title: '崩溃现场',
      description: 'ZERO: "城市的中央数据库突然断电了。重启后数据居然完好无损——这不是魔法，而是 WAL（Write-Ahead Logging）的功劳。在任何数据写入磁盘之前，PostgreSQL 都会先把操作记录写入日志。这就是预写日志——数据库世界的黑匣子。"',
      initSql: FULL_WORLD_WITH_BUILDINGS_SQL + `
CREATE TABLE wal_demo (
  id SERIAL PRIMARY KEY,
  event TEXT NOT NULL,
  payload TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
INSERT INTO wal_demo (event, payload) VALUES
  ('system_boot', '城市数据库启动'),
  ('checkpoint', '自动检查点完成'),
  ('user_login', 'Alice 登录系统');
`,
      defaultSql: "SHOW wal_level;",
      tasks: [
        {
          prompt: '📋 数据参考：表 wal_demo (id, event, payload, created_at)\n\nZERO: "WAL 是 PostgreSQL 的核心安全机制。每次修改数据时，变更先写入 WAL 日志文件，然后才写入实际的数据文件。这样即使断电，重启后也能通过重放 WAL 日志恢复数据。"\n\n先查看当前的 WAL 级别配置：使用 SHOW 命令查看 wal_level 参数。',
          answerSql: "SHOW wal_level;",
          hints: [
            'SHOW 命令可以查看 PostgreSQL 的运行时配置参数',
            'wal_level 决定了 WAL 记录的详细程度：minimal、replica、logical',
            "SHOW wal_level;"
          ],
          successStory: 'ZERO: "wal_level 决定了 WAL 记录多少信息。replica 级别（默认）记录足够的信息来支持流复制和崩溃恢复。logical 级别记录更多，支持逻辑解码。minimal 级别记录最少，只保证崩溃恢复——但不支持复制。在生产环境中，通常使用 replica 或 logical。"'
        },
        {
          prompt: '📋 数据参考：表 wal_demo (id, event, payload, created_at) / 视图 pg_settings (name, setting, short_desc)\n\nZERO: "WAL 的工作流程是：1) 修改先写入 WAL 缓冲区 → 2) COMMIT 时 WAL 刷盘 → 3) 后台进程异步将脏页写入数据文件。让我们查看更多 WAL 相关配置来理解这个流程。"\n\n查询 pg_settings 表，获取所有名称包含 \'wal\' 的配置参数的 name, setting, short_desc 三列，按 name 排序。',
          answerSql: "SELECT name, setting, short_desc\nFROM pg_settings\nWHERE name LIKE '%wal%'\nORDER BY name;",
          hints: [
            'pg_settings 是 PostgreSQL 的系统视图，包含所有配置参数及其当前值和描述',
            "用 WHERE name LIKE '%wal%' 过滤出 WAL 相关的参数",
            "SELECT name, setting, short_desc\nFROM pg_settings\nWHERE name LIKE '%wal%'\nORDER BY name;"
          ],
          successStory: 'ZERO: "这些参数控制着 WAL 的方方面面：wal_buffers 是 WAL 缓冲区大小，wal_segment_size 是单个 WAL 文件的大小（默认 16MB），max_wal_size 控制触发检查点的 WAL 总量上限。理解这些参数是数据库运维的基本功——它们直接影响写入性能和恢复速度。"'
        }
      ]
    },
    {
      id: 'ch7-7',
      title: '检查点',
      description: 'ZERO: "WAL 日志不能无限增长——检查点（Checkpoint）就是 PostgreSQL 的定期存档机制。检查点会把内存中所有脏页刷写到磁盘，然后标记一个恢复起点。崩溃恢复时，只需要从最近的检查点开始重放 WAL，而不是从头开始。"',
      initSql: FULL_WORLD_WITH_BUILDINGS_SQL + `
CREATE TABLE checkpoint_demo (
  id SERIAL PRIMARY KEY,
  batch_name TEXT NOT NULL,
  records_count INTEGER DEFAULT 0,
  processed_at TIMESTAMP DEFAULT NOW()
);
INSERT INTO checkpoint_demo (batch_name, records_count) VALUES
  ('初始化批次', 1000),
  ('数据迁移-A', 5000),
  ('数据迁移-B', 3000);
`,
      defaultSql: "CHECKPOINT;\nSELECT now() AS checkpoint_time;",
      tasks: [
        {
          prompt: '📋 数据参考：表 checkpoint_demo (id, batch_name, records_count, processed_at)\n\nZERO: "手动触发一次检查点，然后查看检查点的相关统计信息。在生产环境中，检查点通常由 PostgreSQL 自动触发（基于时间间隔或 WAL 量），但你也可以手动执行。"\n\n执行以下操作：\n1. 执行 CHECKPOINT 命令手动触发检查点\n2. 查询 pg_stat_bgwriter 视图，获取 checkpoints_timed（定时触发次数）和 checkpoints_req（请求触发次数）',
          answerSql: "CHECKPOINT;\nSELECT checkpoints_timed, checkpoints_req\nFROM pg_stat_bgwriter;",
          checkSql: "SELECT checkpoints_req >= 0 AS has_checkpoint FROM pg_stat_bgwriter;",
          needsTransaction: true,
          hints: [
            'CHECKPOINT 命令强制执行一次检查点——将所有脏页刷写到磁盘',
            'pg_stat_bgwriter 记录了后台写入进程的统计信息，包括检查点次数',
            "CHECKPOINT;\nSELECT checkpoints_timed, checkpoints_req\nFROM pg_stat_bgwriter;"
          ],
          successStory: 'ZERO: "检查点已执行。checkpoints_timed 是定时器自动触发的次数（由 checkpoint_timeout 控制，默认 5 分钟），checkpoints_req 是手动请求或 WAL 量超限触发的次数。你刚才的 CHECKPOINT 命令增加了 checkpoints_req 的计数。检查点越频繁，崩溃恢复越快，但写入性能会下降——这是经典的安全性 vs 性能权衡。"'
        },
        {
          prompt: '📋 数据参考：表 checkpoint_demo (id, batch_name, records_count, processed_at)\n\nZERO: "检查点的频率由两个参数控制：checkpoint_timeout（时间间隔）和 max_wal_size（WAL 累积量）。查看这两个关键参数的当前配置。"\n\n查询 pg_settings 表，获取 checkpoint_timeout 和 max_wal_size 两个参数的 name, setting, unit, short_desc，按 name 排序。',
          answerSql: "SELECT name, setting, unit, short_desc\nFROM pg_settings\nWHERE name IN ('checkpoint_timeout', 'max_wal_size')\nORDER BY name;",
          hints: [
            'pg_settings 的 unit 列显示参数的单位（如 s 表示秒，MB 表示兆字节）',
            "用 WHERE name IN ('参数1', '参数2') 精确匹配多个参数名",
            "SELECT name, setting, unit, short_desc\nFROM pg_settings\nWHERE name IN ('checkpoint_timeout', 'max_wal_size')\nORDER BY name;"
          ],
          successStory: 'ZERO: "checkpoint_timeout 默认 300 秒（5 分钟）——每隔 5 分钟自动触发一次检查点。max_wal_size 默认 1GB——当 WAL 累积超过这个量时也会触发检查点。这两个参数共同决定了崩溃恢复的最大时间窗口：最坏情况下，你最多丢失最近一个检查点周期内的 WAL 数据（但由于 WAL 已经刷盘，实际上不会丢失已提交的事务）。"'
        }
      ]
    },
    {
      id: 'ch7-8',
      title: '恢复过程',
      description: 'ZERO: "崩溃恢复的过程其实很简单：找到最近的检查点 → 从该检查点开始重放 WAL 日志 → 所有已提交的事务恢复，未提交的事务回滚。WAL 的 LSN（Log Sequence Number）就是这个过程的坐标系——每条 WAL 记录都有唯一的 LSN 标识它在日志流中的位置。"',
      initSql: FULL_WORLD_WITH_BUILDINGS_SQL + `
CREATE TABLE recovery_log (
  id SERIAL PRIMARY KEY,
  operation TEXT NOT NULL,
  detail TEXT,
  lsn_snapshot TEXT,
  logged_at TIMESTAMP DEFAULT NOW()
);
`,
      defaultSql: "SELECT pg_current_wal_lsn() AS current_lsn;",
      tasks: [
        {
          prompt: '📋 数据参考：表 recovery_log (id, operation, detail, lsn_snapshot, logged_at)\n\nZERO: "LSN（Log Sequence Number）是 WAL 日志流中的位置标记，格式为 十六进制/十六进制（如 0/1A3B5C0）。每次写入 WAL 都会推进 LSN。先获取当前的 WAL 位置。"\n\n执行以下操作：\n1. 使用 pg_current_wal_lsn() 获取当前 WAL 位置\n2. 向 recovery_log 插入一条记录：operation 为 \'before_write\'，detail 为 \'记录写入前的 LSN 位置\'\n3. 再次获取 pg_current_wal_lsn() 查看 LSN 是否推进了',
          answerSql: "SELECT pg_current_wal_lsn() AS current_lsn;\nINSERT INTO recovery_log (operation, detail) VALUES ('before_write', '记录写入前的 LSN 位置');\nSELECT pg_current_wal_lsn() AS current_lsn;",
          checkSql: "SELECT count(*) AS log_count FROM recovery_log WHERE operation = 'before_write';",
          needsTransaction: true,
          hints: [
            'pg_current_wal_lsn() 返回当前 WAL 写入位置，每次数据修改都会推进这个值',
            'LSN 是单调递增的——任何写操作（INSERT/UPDATE/DELETE）都会产生新的 WAL 记录',
            "SELECT pg_current_wal_lsn() AS current_lsn;\nINSERT INTO recovery_log (operation, detail) VALUES ('before_write', '记录写入前的 LSN 位置');\nSELECT pg_current_wal_lsn() AS current_lsn;"
          ],
          successStory: 'ZERO: "看到 LSN 推进了吗？INSERT 操作产生了新的 WAL 记录，LSN 随之增长。崩溃恢复时，PostgreSQL 会从检查点的 LSN 开始，逐条重放到最新的 LSN——这就是 REDO 过程。LSN 就像时间线上的刻度，精确标记着每一次数据变更的位置。"'
        },
        {
          prompt: '📋 数据参考：表 recovery_log (id, operation, detail, lsn_snapshot, logged_at)\n\nZERO: "WAL 的大小可以通过系统函数计算。让我们看看两个 LSN 之间产生了多少字节的 WAL 数据——这能帮你理解不同操作的 WAL 开销。"\n\n执行以下操作：\n1. 批量插入 50 条记录到 recovery_log（使用 generate_series）\n2. 查询 pg_current_wal_lsn() 获取当前 LSN\n3. 查询 pg_wal_lsn_diff(pg_current_wal_lsn(), \'0/0\') 获取从起点到现在的总 WAL 字节数',
          answerSql: "INSERT INTO recovery_log (operation, detail)\nSELECT 'batch_write', '批量写入测试-' || g\nFROM generate_series(1, 50) AS g;\nSELECT pg_current_wal_lsn() AS current_lsn;\nSELECT pg_wal_lsn_diff(pg_current_wal_lsn(), '0/0') AS total_wal_bytes;",
          checkSql: "SELECT count(*) >= 50 AS batch_done FROM recovery_log WHERE operation = 'batch_write';",
          needsTransaction: true,
          hints: [
            'generate_series(1, 50) 生成 1 到 50 的序列，配合 INSERT ... SELECT 实现批量插入',
            'pg_wal_lsn_diff(lsn1, lsn2) 计算两个 LSN 之间的字节差',
            "INSERT INTO recovery_log (operation, detail)\nSELECT 'batch_write', '批量写入测试-' || g\nFROM generate_series(1, 50) AS g;\nSELECT pg_current_wal_lsn() AS current_lsn;\nSELECT pg_wal_lsn_diff(pg_current_wal_lsn(), '0/0') AS total_wal_bytes;"
          ],
          successStory: 'ZERO: "50 条 INSERT 产生了可观的 WAL 数据。在生产环境中，监控 WAL 生成速率是运维的重要指标——WAL 生成太快意味着写入压力大，可能需要调整 checkpoint_timeout 或增加磁盘 I/O 能力。pg_wal_lsn_diff 是计算 WAL 增量的利器。"'
        }
      ]
    },
    {
      id: 'ch7-9',
      title: '持久性验证',
      description: 'ZERO: "ACID 中的 D——Durability（持久性）——是 WAL 的终极承诺：一旦事务 COMMIT 成功，数据就不会丢失，即使下一秒断电。这个承诺的实现依赖于 synchronous_commit 参数——它控制 COMMIT 时是否等待 WAL 刷盘完成。"',
      initSql: FULL_WORLD_WITH_BUILDINGS_SQL + `
CREATE TABLE durability_test (
  id SERIAL PRIMARY KEY,
  message TEXT NOT NULL,
  sync_mode TEXT,
  committed_at TIMESTAMP DEFAULT NOW()
);
`,
      defaultSql: "SHOW synchronous_commit;",
      tasks: [
        {
          prompt: '📋 数据参考：表 durability_test (id, message, sync_mode, committed_at)\n\nZERO: "synchronous_commit 是持久性的开关。当它为 on 时，COMMIT 必须等待 WAL 写入磁盘才返回——绝对安全但稍慢。设为 off 时，COMMIT 立即返回，WAL 异步刷盘——更快但有极小的数据丢失窗口。"\n\n执行以下操作：\n1. 查看当前 synchronous_commit 的值\n2. 查询 pg_settings 获取 synchronous_commit 的 name, setting, short_desc, context 四列',
          answerSql: "SHOW synchronous_commit;\nSELECT name, setting, short_desc, context\nFROM pg_settings\nWHERE name = 'synchronous_commit';",
          checkSql: "SELECT name, setting FROM pg_settings WHERE name = 'synchronous_commit';",
          needsTransaction: true,
          hints: [
            'SHOW 查看参数值，pg_settings 可以获取更详细的元信息（如 context 表示修改该参数需要的权限级别）',
            'context = user 表示可以在会话级别用 SET 修改，不需要重启',
            "SHOW synchronous_commit;\nSELECT name, setting, short_desc, context\nFROM pg_settings\nWHERE name = 'synchronous_commit';"
          ],
          successStory: 'ZERO: "synchronous_commit 默认为 on——最安全的模式。context 为 user 意味着你可以在会话级别修改它。在某些场景下（如批量导入非关键数据），临时关闭同步提交可以大幅提升写入速度，代价是断电时可能丢失最近几百毫秒内提交的事务。"'
        },
        {
          prompt: '📋 数据参考：表 durability_test (id, message, sync_mode, committed_at)\n\nZERO: "最后的实验：用事务写入数据，验证 WAL 的持久性保证。我们在一个事务中插入数据并记录 LSN，然后执行 CHECKPOINT 确保数据落盘。"\n\n执行以下操作：\n1. BEGIN 开启事务\n2. 向 durability_test 插入一条记录：message 为 \'持久性验证\'，sync_mode 为当前 synchronous_commit 的值（用子查询从 pg_settings 获取）\n3. COMMIT 提交\n4. 执行 CHECKPOINT\n5. 查询 durability_test 全表确认数据已持久化',
          answerSql: "BEGIN;\nINSERT INTO durability_test (message, sync_mode)\nVALUES ('持久性验证', (SELECT setting FROM pg_settings WHERE name = 'synchronous_commit'));\nCOMMIT;\nCHECKPOINT;\nSELECT * FROM durability_test ORDER BY id;",
          checkSql: "SELECT count(*) AS verified FROM durability_test WHERE message = '持久性验证';",
          needsTransaction: true,
          hints: [
            '子查询可以嵌入 INSERT 的 VALUES 中：VALUES (\'文本\', (SELECT ...))',
            'COMMIT 后数据已持久化到 WAL，CHECKPOINT 进一步确保数据页也刷盘',
            "BEGIN;\nINSERT INTO durability_test (message, sync_mode)\nVALUES ('持久性验证', (SELECT setting FROM pg_settings WHERE name = 'synchronous_commit'));\nCOMMIT;\nCHECKPOINT;\nSELECT * FROM durability_test ORDER BY id;"
          ],
          successStory: 'ZERO: "数据已持久化。整个流程是：COMMIT → WAL 刷盘（synchronous_commit=on 保证）→ CHECKPOINT → 数据页刷盘。即使在 COMMIT 和 CHECKPOINT 之间断电，重启后 PostgreSQL 也会通过重放 WAL 恢复这条记录。\n\n从系统列到版本链，从事务控制到隔离级别，再到空间回收、WAL 预写日志、检查点机制和持久性保证——你已经掌握了 PostgreSQL MVCC 和持久化的核心机制。这座城市的数据库，从此有了时间裂缝的守护和黑匣子的保护。"'
        }
      ]
    }
  ]
}
