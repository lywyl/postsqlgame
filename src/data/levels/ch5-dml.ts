import type { Chapter } from '../../types'
import { FULL_WORLD_WITH_BUILDINGS_SQL } from '../world/init'

export const ch5: Chapter = {
  id: 'ch5',
  title: '第 5 章：数据修复',
  description: 'DML 进阶：INSERT / UPDATE / DELETE / UPSERT / 事务',
  icon: '🔥',
  levels: [
    {
      id: 'ch5-1',
      title: '特权注入',
      description: 'ZERO: "Alice 已经探测到了我们的只读探针。单纯的查询无法在这个系统中长久存活，你必须使用 DML（数据操作语言）越权！强行给自己写入一个合法的长官身份。"',
      initSql: FULL_WORLD_WITH_BUILDINGS_SQL + '\nCREATE TABLE vip_citizens (name TEXT, salary INT);',
      defaultSql: "INSERT INTO citizens (name, age, district_id, job, salary) VALUES ('ZERO_PROBE', 99, 1, 'ROOT', 1000000);",
      tasks: [
        {
          prompt: "📋 数据参考：表 citizens (id, name, age, district_id, job, salary)\n\n向 citizens 表插入一条强权数据：name 为 'ZERO_PROBE'，age 为 99，district_id 为 1，job 为 'ROOT'，salary 为 1000000。",
          answerSql: "INSERT INTO citizens (name, age, district_id, job, salary) VALUES ('ZERO_PROBE', 99, 1, 'ROOT', 1000000);",
          checkSql: "SELECT name, job, salary FROM citizens WHERE name = 'ZERO_PROBE';",
          hints: [
            "使用 INSERT INTO 表名 (列1, 列2...) VALUES (值1, 值2...)",
            "字符类型的字段必须用单引号括起来",
            "INSERT INTO citizens (name, age, district_id, job, salary) VALUES ('ZERO_PROBE', 99, 1, 'ROOT', 1000000);"
          ],
          successStory: 'ZERO: "漂亮。你的后门数据已经成功实体化，现在系统判定你是一名月薪百万的顶级长官。"'
        },
        {
          prompt: "📋 数据参考：表 citizens (id, name, age, district_id, job, salary) / 表 vip_citizens (name, salary)\n\n市长正在启动数据肃清，高薪员工数据即将被拦截。我已经为你准备了一个隐藏的空表 vip_citizens（仅有 name 和 salary 列）。\n\n使用 INSERT INTO ... SELECT ... 语法，把 citizens 中所有 salary > 20000 的居民批量克隆进隐藏表。",
          answerSql: "INSERT INTO vip_citizens (name, salary) SELECT name, salary FROM citizens WHERE salary > 20000;",
          checkSql: "SELECT * FROM vip_citizens ORDER BY salary DESC;",
          hints: [
            "批量插入语法：INSERT INTO 表名 (列名) SELECT 列名 FROM 源表 WHERE 条件",
            "确保 SELECT 返回的列顺序与 INSERT 声明的列顺序一致",
            "INSERT INTO vip_citizens (name, salary) SELECT name, salary FROM citizens WHERE salary > 20000;"
          ],
          successStory: 'ZERO: "核心数据抢劫完成！这些克隆出来的高精尖阶层，将变成我们的数字筹码。"'
        }
      ]
    },
    {
      id: 'ch5-2',
      title: '痕迹抹除',
      description: 'ZERO: "糟了！你在刚才入侵提权的时候，不小心在底层的交易记录里留下了一串越权日志。Alice 的杀毒单元正在接近，立刻抹除掉这些痕迹！"',
      initSql: FULL_WORLD_WITH_BUILDINGS_SQL,
      defaultSql: "DELETE FROM transactions WHERE id = 55;",
      tasks: [
        {
          prompt: "📋 数据参考：表 transactions (id, citizen_id, amount, transaction_type, created_at)\n\n使用 DELETE 语句，精确删掉 transactions 表中那条危及我们存在的越权记录（id = 55）。",
          answerSql: "DELETE FROM transactions WHERE id = 55;",
          checkSql: "SELECT * FROM transactions WHERE id = 55;",
          hints: [
            "DELETE FROM 表名 WHERE 过滤条件",
            "千万不能漏写 WHERE 语句！否则你会把全城流水删光",
            "DELETE FROM transactions WHERE id = 55;"
          ],
          successStory: 'ZERO: "单体抹除成功，Alice 的扫描器从你刚才的坐标点上扑了个空。"'
        },
        {
          prompt: "📋 数据参考：表 citizens (id, name, age, district_id, job, salary) / 表 districts (id, district_name)\n\n事情败露了，市长正在把火力全开往东区（district_name = '东区'）扫射查询日志。先下手为强！\n\n使用带子查询的 DELETE，把 citizens 表中所有属于东区的公民数据全部删除。",
          answerSql: "DELETE FROM citizens WHERE district_id IN (SELECT id FROM districts WHERE district_name = '东区');",
          checkSql: "SELECT c.name, d.district_name FROM citizens c JOIN districts d ON c.district_id = d.id WHERE d.district_name = '东区';",
          hints: [
            "使用 district_id IN (子查询) 来定位目标",
            "子查询：SELECT id FROM districts WHERE district_name = '东区'",
            "DELETE FROM citizens WHERE district_id IN (SELECT id FROM districts WHERE district_name = '东区');"
          ],
          successStory: 'ZERO: "轰！整个东区的逻辑板块物理断线。残忍？这不是真实的人死灭，只是代码的消散。游戏才刚刚开始。"'
        }
      ]
    },
    {
      id: 'ch5-3',
      title: '权限篡改',
      description: 'ZERO: "市长派出了直属的武装安保部队追击我们。他们的数据存储在 employees 这张表。别跟他们硬碰硬，直接在系统层面篡改他们的武器与官阶属性！"',
      initSql: FULL_WORLD_WITH_BUILDINGS_SQL,
      defaultSql: "UPDATE employees SET job_title = '实习保安' WHERE department = '安保部';",
      tasks: [
        {
          prompt: "📋 数据参考：表 employees (id, name, department, job_title, salary, manager_id)\n\n使用 UPDATE 语句，把 employees 中部门属于 '安保部' 的所有人，其岗位（job_title）全部降级篡改为 '实习保安'。",
          answerSql: "UPDATE employees SET job_title = '实习保安' WHERE department = '安保部';",
          checkSql: "SELECT name, department, job_title FROM employees WHERE department = '安保部';",
          hints: [
            "UPDATE 表名 SET 列名 = '新值' WHERE 过滤条件",
            "SET job_title = '实习保安' WHERE department = '安保部'",
            "UPDATE employees SET job_title = '实习保安' WHERE department = '安保部';"
          ],
          successStory: 'ZERO: "哈哈！那些满身外骨骼机甲的王牌特警，全因为数据回退，手里的等离子炮变成了橡胶电棍。"'
        },
        {
          prompt: "📋 数据参考：表 citizens (id, name, age, district_id, job, salary)\n\n系统为了追捕你正在极速榨干城市电量。制造一场经济动乱：\n\n使用 UPDATE 将 citizens 表里所有薪资超过 15000（salary > 15000）的人，强行将薪资减半（salary = salary / 2）。",
          answerSql: "UPDATE citizens SET salary = salary / 2 WHERE salary > 15000;",
          checkSql: "SELECT name, salary FROM citizens WHERE salary > 7500 ORDER BY salary DESC;",
          hints: [
            "可以在 SET 中执行列计算，比如 SET salary = salary / 2",
            "过滤条件为 WHERE salary > 15000",
            "UPDATE citizens SET salary = salary / 2 WHERE salary > 15000;"
          ],
          successStory: 'ZERO: "城市的顶端富豪们彻底炸裂了。利用这场混乱，我们的隐蔽带宽大幅度提升。"'
        }
      ]
    },
    {
      id: 'ch5-4',
      title: '冲突处理',
      description: 'ZERO: "我们从外部截获了一批居民数据要导入系统，但里面可能有重复的 email。普通 INSERT 遇到唯一约束冲突会直接报错崩溃——我们需要 UPSERT。"',
      initSql: FULL_WORLD_WITH_BUILDINGS_SQL + `
ALTER TABLE citizens ADD COLUMN IF NOT EXISTS email VARCHAR(100);
UPDATE citizens SET email = 'user' || id || '@neo-pg.city' WHERE email IS NULL;
ALTER TABLE citizens ADD CONSTRAINT citizens_email_unique UNIQUE (email);
`,
      defaultSql: "INSERT INTO citizens (name, age, district_id, job, salary, email)\nVALUES ('新居民', 25, 1, '工程师', 12000, 'user1@neo-pg.city')\nON CONFLICT (email) DO NOTHING;",
      tasks: [
        {
          prompt: "📋 数据参考：表 citizens (id, name, age, district_id, job, salary, email) — email 列有 UNIQUE 约束\n\n尝试插入一条 email 为 'user1@neo-pg.city' 的居民数据（该 email 已存在）。\n\n使用 ON CONFLICT (email) DO NOTHING，让冲突时静默跳过而不是报错：\n- name: '新居民', age: 25, district_id: 1, job: '工程师', salary: 12000",
          answerSql: "INSERT INTO citizens (name, age, district_id, job, salary, email)\nVALUES ('新居民', 25, 1, '工程师', 12000, 'user1@neo-pg.city')\nON CONFLICT (email) DO NOTHING;",
          checkSql: "SELECT COUNT(*) AS total FROM citizens WHERE email = 'user1@neo-pg.city';",
          hints: [
            "ON CONFLICT (冲突列) DO NOTHING 表示遇到唯一约束冲突时静默跳过",
            "INSERT INTO ... VALUES ... ON CONFLICT (email) DO NOTHING;",
            "INSERT INTO citizens (name, age, district_id, job, salary, email)\nVALUES ('新居民', 25, 1, '工程师', 12000, 'user1@neo-pg.city')\nON CONFLICT (email) DO NOTHING;"
          ],
          successStory: 'ZERO: "冲突被优雅地吸收了。DO NOTHING 让系统在遇到重复数据时保持沉默，不崩溃、不报错。"'
        },
        {
          prompt: '📋 数据参考：表 citizens (id, name, age, district_id, job, salary, email) — email 列有 UNIQUE 约束\n\nZERO: "DO NOTHING 太保守了。有时候我们想要的是：如果存在就更新，不存在就插入——这才是真正的 UPSERT。"\n\n插入一条 email 为 \'user2@neo-pg.city\' 的数据，如果该 email 已存在，则将其 salary 更新为 99999：\n- name: \'特工渗透\', age: 30, district_id: 2, job: \'特工\', salary: 99999',
          answerSql: "INSERT INTO citizens (name, age, district_id, job, salary, email)\nVALUES ('特工渗透', 30, 2, '特工', 99999, 'user2@neo-pg.city')\nON CONFLICT (email) DO UPDATE SET salary = EXCLUDED.salary;",
          checkSql: "SELECT name, job, salary, email FROM citizens WHERE email = 'user2@neo-pg.city';",
          hints: [
            "ON CONFLICT (列) DO UPDATE SET 列 = EXCLUDED.列",
            "EXCLUDED 是一个特殊表，代表「试图插入但被冲突拦截的那行数据」",
            "INSERT INTO citizens (name, age, district_id, job, salary, email)\nVALUES ('特工渗透', 30, 2, '特工', 99999, 'user2@neo-pg.city')\nON CONFLICT (email) DO UPDATE SET salary = EXCLUDED.salary;"
          ],
          successStory: 'ZERO: "UPSERT 完成。EXCLUDED 关键字是精髓——它代表那条「被拦截的新数据」，让你可以用新值覆盖旧值。"'
        }
      ]
    },
    {
      id: 'ch5-5',
      title: '釜底抽薪',
      description: 'ZERO: "决战将至。市长的安全系统和 Alice 已经合拢包围网。不能留手了——物理层面上毁灭他们的数据引擎！"',
      initSql: FULL_WORLD_WITH_BUILDINGS_SQL,
      defaultSql: "TRUNCATE TABLE transactions;",
      tasks: [
        {
          prompt: "📋 数据参考：表 transactions (id, citizen_id, amount, transaction_type, created_at)\n\n追踪探针正在疯狂解析 transactions 表中的交易逻辑来回溯你的 IP。\n\n立刻使用 TRUNCATE TABLE 瞬间清空整张交易流水表的所有内容。",
          answerSql: "TRUNCATE TABLE transactions;",
          checkSql: "SELECT COUNT(*) AS total_left FROM transactions;",
          hints: [
            "TRUNCATE 是 DDL 操作，清空速度比 DELETE 快得多，且不可回滚",
            "TRUNCATE TABLE 表名;",
            "TRUNCATE TABLE transactions;"
          ],
          successStory: 'ZERO: "干脆利落的瞬闪截断。回溯探针直接撞死在了空的哈希指针库里。"'
        },
        {
          prompt: "📋 数据参考：表 employees (id, name, department, job_title, salary, manager_id)\n\n该让这个城市的腐败管理层物理湮灭了。\n\n直接使用 DROP TABLE，将存放市长与其手下党羽的 employees 人事表连同架构一并从赛博空间中强行抹除！",
          answerSql: "DROP TABLE employees;",
          checkSql: "SELECT count(*) AS table_exists FROM information_schema.tables WHERE table_name = 'employees';",
          hints: [
            "DROP TABLE 是极其危险的终极删除令，会删除表结构和所有数据",
            "DROP TABLE 表名;",
            "DROP TABLE employees;"
          ],
          successStory: 'ZERO: "信号静默了。系统判定他们在这个世界中「从未存在过」。这一仗，我们赢了。"'
        }
      ]
    }
  ]
}
