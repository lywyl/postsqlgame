// TODO: 未启用章节，章节 ID 需重新编号后才能接入 chapters.ts
import type { Chapter } from '../../types'
import { FULL_WORLD_WITH_BUILDINGS_SQL } from '../world/init'

export const ch13: Chapter = {
  id: 'ch13',
  title: '第 13 章：自动化防线',
  description: '函数、触发器与存储过程：自定义函数 / 返回表 / 触发器 / 存储过程 / 异常处理',
  icon: '⚙️',
  levels: [
    {
      id: 'ch13-1',
      title: '自定义函数',
      description: 'Alice: "手动查询太慢了——Orion 的系统每秒钟都在变化。我们需要自动化工具，把常用查询封装成函数，一键调用。PL/pgSQL 是 PostgreSQL 的编程语言，让你在数据库里写逻辑。"',
      initSql: FULL_WORLD_WITH_BUILDINGS_SQL,
      defaultSql: `CREATE OR REPLACE FUNCTION get_district_stats(p_district_id INTEGER)
RETURNS TABLE(district_name TEXT, citizen_count BIGINT, avg_salary NUMERIC)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT d.district_name, COUNT(*)::BIGINT, ROUND(AVG(c.salary), 2)
  FROM citizens c
  JOIN districts d ON c.district_id = d.id
  WHERE c.district_id = p_district_id
  GROUP BY d.district_name;
END;
$$;`,
      tasks: [
        {
          prompt: `Alice: "函数把常用查询封装成可复用的单元。你可以传参数进去，得到结果出来——就像数据库里的 API。"\n\n创建函数 get_district_stats：\n- 接收一个参数 p_district_id（区编号）\n- 返回 TABLE(district_name TEXT, citizen_count BIGINT, avg_salary NUMERIC)\n- 内部查询该区的居民数量和平均薪资\n- 语言 PL/pgSQL\n\n创建后，调用该函数验证效果：SELECT * FROM get_district_stats(1);`,
          answerSql: `CREATE OR REPLACE FUNCTION get_district_stats(p_district_id INTEGER)
RETURNS TABLE(district_name TEXT, citizen_count BIGINT, avg_salary NUMERIC)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT d.district_name, COUNT(*)::BIGINT, ROUND(AVG(c.salary), 2)
  FROM citizens c
  JOIN districts d ON c.district_id = d.id
  WHERE c.district_id = p_district_id
  GROUP BY d.district_name;
END;
$$;
SELECT * FROM get_district_stats(1);`,
          checkSql: `SELECT proname FROM pg_proc WHERE proname = 'get_district_stats';`,
          needsTransaction: true,
          hints: [
            'CREATE OR REPLACE FUNCTION 函数名(参数) RETURNS 返回类型 LANGUAGE plpgsql AS $$ BEGIN ... END; $$;',
            'RETURNS TABLE(列名 类型, ...) 定义返回表结构，RETURN QUERY + SELECT 填充结果',
            'CREATE OR REPLACE FUNCTION get_district_stats(p_district_id INTEGER)\\nRETURNS TABLE(district_name TEXT, citizen_count BIGINT, avg_salary NUMERIC)\\nLANGUAGE plpgsql AS $$\\nBEGIN\\n  RETURN QUERY\\n  SELECT d.district_name, COUNT(*)::BIGINT, ROUND(AVG(c.salary), 2)\\n  FROM citizens c\\n  JOIN districts d ON c.district_id = d.id\\n  WHERE c.district_id = p_district_id\\n  GROUP BY d.district_name;\\nEND;\\n$$;'
          ],
          successStory: 'Alice: "函数创建成功。调用 get_district_stats(1) 就能立即看到东区的统计数据——不用再写一长串 SQL。函数是数据库自动化的第一步。"'
        },
        {
          prompt: `Alice: "RETURNS SETOF 让函数直接返回一张表的行子集——比 RETURNS TABLE 更灵活。"\n\n创建函数 high_earners(min_salary NUMERIC)，返回 SETOF citizens（所有薪资超过 min_salary 的市民）。创建后调用验证：SELECT * FROM high_earners(20000);`,
          answerSql: `CREATE OR REPLACE FUNCTION high_earners(min_salary NUMERIC)
RETURNS SETOF citizens
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY SELECT * FROM citizens WHERE salary > min_salary ORDER BY salary DESC;
END;
$$;
SELECT * FROM high_earners(20000);`,
          checkSql: `SELECT proname FROM pg_proc WHERE proname = 'high_earners';`,
          needsTransaction: true,
          hints: [
            'RETURNS SETOF 表名 让函数返回该表的行子集，不需要手动定义列',
            'RETURN QUERY SELECT ... 直接返回查询结果',
            'CREATE OR REPLACE FUNCTION high_earners(min_salary NUMERIC)\\nRETURNS SETOF citizens\\nLANGUAGE plpgsql AS $$\\nBEGIN\\n  RETURN QUERY SELECT * FROM citizens WHERE salary > min_salary ORDER BY salary DESC;\\nEND;\\n$$;'
          ],
          successStory: 'Alice: "SETOF 更简洁——你不需要列出返回列，直接说返回 citizens 的行子集即可。high_earners(20000) 一键筛选出所有高薪市民。函数让复杂数据触手可及。"'
        }
      ]
    },
    {
      id: 'ch13-2',
      title: '返回表',
      description: 'ZERO: "函数不仅能返回简单的值——它还能返回完整的表，甚至是跨表联接的结果。这让复杂的报表查询变成一行函数调用。"',
      initSql: FULL_WORLD_WITH_BUILDINGS_SQL,
      defaultSql: `SELECT * FROM get_top_earners(5);`,
      tasks: [
        {
          prompt: `ZERO: "创建函数 get_top_earners，返回薪资前 N 名市民的姓名、薪资和所在区名称。"\n\n创建函数 get_top_earners(p_limit INTEGER)：\n- 返回 TABLE(name TEXT, salary NUMERIC, district TEXT)\n- 查询 citizens JOIN districts，按薪资降序取前 p_limit 名\n- 语言 PL/pgSQL\n\n创建后调用：SELECT * FROM get_top_earners(5);`,
          answerSql: `CREATE OR REPLACE FUNCTION get_top_earners(p_limit INTEGER)
RETURNS TABLE(name TEXT, salary NUMERIC, district TEXT)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT c.name, c.salary, d.district_name
  FROM citizens c
  JOIN districts d ON c.district_id = d.id
  ORDER BY c.salary DESC
  LIMIT p_limit;
END;
$$;`,
          checkSql: `SELECT proname, prorettype::regtype FROM pg_proc WHERE proname = 'get_top_earners';`,
          needsTransaction: true,
          hints: [
            'RETURNS TABLE(列名 类型, ...) 定义返回的列结构',
            'LIMIT p_limit 使用函数参数控制返回行数',
            'CREATE OR REPLACE FUNCTION get_top_earners(p_limit INTEGER)\\nRETURNS TABLE(name TEXT, salary NUMERIC, district TEXT)\\nLANGUAGE plpgsql AS $$\\nBEGIN\\n  RETURN QUERY\\n  SELECT c.name, c.salary, d.district_name\\n  FROM citizens c\\n  JOIN districts d ON c.district_id = d.id\\n  ORDER BY c.salary DESC\\n  LIMIT p_limit;\\nEND;\\n$$;'
          ],
          successStory: 'ZERO: "get_top_earners(5) 返回前 5 名高薪市民的完整信息。函数把复杂的多表联接封装成简单调用——这才是数据库该有的样子。"'
        },
        {
          prompt: `ZERO: "再写一个聚合函数 count_by_district，返回每个区的居民数量。"\n\n创建函数 count_by_district()：\n- 无参数\n- 返回 TABLE(district_id INTEGER, district_name TEXT, cnt BIGINT)\n- 查询 citizens JOIN districts 按区分组计数\n\n创建后调用：SELECT * FROM count_by_district();`,
          answerSql: `CREATE OR REPLACE FUNCTION count_by_district()
RETURNS TABLE(district_id INTEGER, district_name TEXT, cnt BIGINT)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT c.district_id, d.district_name, COUNT(*)::BIGINT AS cnt
  FROM citizens c
  JOIN districts d ON c.district_id = d.id
  GROUP BY c.district_id, d.district_name
  ORDER BY cnt DESC;
END;
$$;`,
          checkSql: `SELECT proname FROM pg_proc WHERE proname = 'count_by_district';`,
          needsTransaction: true,
          hints: [
            '无参函数定义：CREATE OR REPLACE FUNCTION 函数名() RETURNS TABLE(...) ...',
            'GROUP BY + COUNT(*) 按区分组计数',
            'CREATE OR REPLACE FUNCTION count_by_district()\\nRETURNS TABLE(district_id INTEGER, district_name TEXT, cnt BIGINT)\\nLANGUAGE plpgsql AS $$\\nBEGIN\\n  RETURN QUERY\\n  SELECT c.district_id, d.district_name, COUNT(*)::BIGINT AS cnt\\n  FROM citizens c\\n  JOIN districts d ON c.district_id = d.id\\n  GROUP BY c.district_id, d.district_name\\n  ORDER BY cnt DESC;\\nEND;\\n$$;'
          ],
          successStory: 'ZERO: "一键查看各区人口分布。从简单函数到返回表的聚合函数，你已经掌握了 PL/pgSQL 函数的全部基础——参数、返回值、查询封装。下一步：让函数在数据变化时自动触发。"'
        }
      ]
    },
    {
      id: 'ch13-3',
      title: '触发器',
      description: 'ZERO: "触发器是数据库的自动驾驶系统——当特定事件发生时，触发器自动执行预设逻辑。薪资变更时自动记录审计日志？不需要人工看守，触发器帮你盯着。"',
      initSql: FULL_WORLD_WITH_BUILDINGS_SQL + `
CREATE TABLE audit_log (
  id SERIAL PRIMARY KEY,
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL,
  old_data JSONB,
  new_data JSONB,
  operator TEXT,
  operated_at TIMESTAMP DEFAULT NOW()
);`,
      defaultSql: `CREATE OR REPLACE FUNCTION log_salary_change()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.salary IS DISTINCT FROM NEW.salary THEN
    INSERT INTO audit_log (table_name, operation, old_data, new_data)
    VALUES ('citizens', 'UPDATE',
      jsonb_build_object('id', OLD.id, 'name', OLD.name, 'salary', OLD.salary),
      jsonb_build_object('id', NEW.id, 'name', NEW.name, 'salary', NEW.salary));
  END IF;
  RETURN NEW;
END;
$$;`,
      tasks: [
        {
          prompt: `ZERO: "首先创建触发器函数 log_salary_change——当 citizens 表的 salary 列被修改时，自动将变更记录到 audit_log 表。"\n\n创建触发器函数 log_salary_change()：\n- RETURNS TRIGGER\n- 当 TG_OP = 'UPDATE' 且 OLD.salary != NEW.salary 时\n- 向 audit_log 插入一条记录\n- 返回 NEW\n\n然后创建触发器 trg_salary_audit：AFTER UPDATE ON citizens FOR EACH ROW EXECUTE FUNCTION log_salary_change()`,
          answerSql: `CREATE OR REPLACE FUNCTION log_salary_change()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.salary IS DISTINCT FROM NEW.salary THEN
    INSERT INTO audit_log (table_name, operation, old_data, new_data)
    VALUES ('citizens', 'UPDATE',
      jsonb_build_object('id', OLD.id, 'name', OLD.name, 'salary', OLD.salary),
      jsonb_build_object('id', NEW.id, 'name', NEW.name, 'salary', NEW.salary));
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_salary_audit
AFTER UPDATE ON citizens
FOR EACH ROW EXECUTE FUNCTION log_salary_change();`,
          checkSql: `SELECT tgname FROM pg_trigger WHERE tgrelid = 'citizens'::regclass AND tgname = 'trg_salary_audit';`,
          needsTransaction: true,
          hints: [
            '触发器函数用 RETURNS TRIGGER，内部用 TG_OP 判断操作类型',
            'OLD 和 NEW 分别代表修改前后的行数据',
            'CREATE OR REPLACE FUNCTION log_salary_change() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN ... RETURN NEW; END; $$;'
          ],
          successStory: 'ZERO: "触发器已激活。从现在起，任何对 citizens 表 salary 列的修改都会被自动记录到 audit_log 表。这就是数据库的自动驾驶——不需要人工盯守，变更追踪自动完成。"'
        },
        {
          prompt: `ZERO: "触发器只有被触发才有意义。来测试一下——修改某个市民的薪资，然后检查 audit_log 是否有记录。"\n\n将 id=1 的市民薪资增加 10%（乘以 1.1），然后查询 audit_log 表的最后一条记录。`,
          answerSql: `UPDATE citizens SET salary = salary * 1.1 WHERE id = 1;
SELECT * FROM audit_log ORDER BY id DESC LIMIT 1;`,
          checkSql: `SELECT count(*) FROM audit_log WHERE table_name = 'citizens' AND operation = 'UPDATE';`,
          needsTransaction: true,
          hints: [
            '触发器会在 UPDATE 执行后自动触发，你不需要手动调用',
            'UPDATE citizens SET salary = salary * 1.1 WHERE id = 1; 然后查询 audit_log'
          ],
          successStory: 'ZERO: "审计日志已自动记录！old_data 保存了修改前的薪资，new_data 保存了修改后的薪资。任何人试图偷偷改薪都逃不过触发器的监控。"'
        },
        {
          prompt: `ZERO: "触发器还能做数据验证——BEFORE INSERT 触发器可以在数据写入前检查合法性，不合法就拒绝。"\n\n创建触发器函数 validate_salary()：\n- BEFORE INSERT 触发器\n- 如果 NEW.salary < 0，抛出异常 RAISE EXCEPTION '薪资不能为负数'\n- 否则返回 NEW\n\n创建触发器 trg_validate_salary：BEFORE INSERT ON citizens FOR EACH ROW EXECUTE FUNCTION validate_salary()`,
          answerSql: `CREATE OR REPLACE FUNCTION validate_salary()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.salary < 0 THEN
    RAISE EXCEPTION '薪资不能为负数';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validate_salary
BEFORE INSERT ON citizens
FOR EACH ROW EXECUTE FUNCTION validate_salary();`,
          checkSql: `SELECT tgname FROM pg_trigger WHERE tgrelid = 'citizens'::regclass AND tgname = 'trg_validate_salary';`,
          needsTransaction: true,
          hints: [
            'BEFORE 触发器在操作执行前运行，可以验证甚至修改数据',
            'RAISE EXCEPTION 会中止当前事务并返回错误信息',
            'CREATE OR REPLACE FUNCTION validate_salary() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN IF NEW.salary < 0 THEN RAISE EXCEPTION ...; END IF; RETURN NEW; END; $$;'
          ],
          successStory: 'ZERO: "数据验证触发器就位。AFTER 触发器用于审计追踪，BEFORE 触发器用于数据验证——两者组合就是数据库的免疫系统。任何非法数据都无法侵入。"'
        }
      ]
    },
    {
      id: 'ch13-4',
      title: '存储过程',
      description: 'Alice: "函数只能做查询和一些简单逻辑。存储过程（PROCEDURE）更强——它可以在一个调用里执行多条 SQL，甚至控制事务。适合批量操作。"',
      initSql: FULL_WORLD_WITH_BUILDINGS_SQL,
      defaultSql: `CALL transfer_citizens(2, 1, 3);`,
      tasks: [
        {
          prompt: `Alice: "创建存储过程 transfer_citizens——把指定数量的市民从一个区迁移到另一个区。这涉及多条 UPDATE，需要事务保护。"\n\n创建存储过程 transfer_citizens(p_from_district INTEGER, p_to_district INTEGER, p_count INTEGER)：\n- 把 citizens 表中 district_id = p_from_district 的前 p_count 个市民迁移到 p_to_district\n- 语言 PL/pgSQL`,
          answerSql: `CREATE OR REPLACE PROCEDURE transfer_citizens(p_from_district INTEGER, p_to_district INTEGER, p_count INTEGER)
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE citizens SET district_id = p_to_district
  WHERE id IN (
    SELECT id FROM citizens
    WHERE district_id = p_from_district
    ORDER BY id
    LIMIT p_count
  );
END;
$$;`,
          checkSql: `SELECT proname FROM pg_proc WHERE proname = 'transfer_citizens';`,
          needsTransaction: true,
          hints: [
            'CREATE OR REPLACE PROCEDURE 过程名(参数) LANGUAGE plpgsql AS $$ BEGIN ... END; $$;',
            'PROCEDURE 用 CALL 调用，不像 FUNCTION 用 SELECT',
            'UPDATE citizens SET district_id = p_to_district WHERE id IN (SELECT id FROM citizens WHERE district_id = p_from_district LIMIT p_count);'
          ],
          successStory: 'Alice: "存储过程把复杂操作封装成一键调用。批量迁移再也不用手动一条条写了。"'
        },
        {
          prompt: `Alice: "再写一个存储过程 bulk_raise——给所有市民按百分比加薪。"\n\n创建存储过程 bulk_raise(p_percent NUMERIC)：\n- UPDATE citizens SET salary = salary * (1 + p_percent / 100)\n- 语言 PL/pgSQL`,
          answerSql: `CREATE OR REPLACE PROCEDURE bulk_raise(p_percent NUMERIC)
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE citizens SET salary = salary * (1 + p_percent / 100);
END;
$$;`,
          checkSql: `SELECT proname FROM pg_proc WHERE proname = 'bulk_raise';`,
          needsTransaction: true,
          hints: [
            'PROCEDURE 和 FUNCTION 的主要区别：PROCEDURE 用 CALL 调用，不返回值',
            '百分比转小数：1 + p_percent / 100',
            'CREATE OR REPLACE PROCEDURE bulk_raise(p_percent NUMERIC) LANGUAGE plpgsql AS $$ BEGIN UPDATE citizens SET salary = salary * (1 + p_percent / 100); END; $$;'
          ],
          successStory: 'Alice: "批量加薪一键完成。存储过程是运维自动化的利器——把复杂的批量操作封装成单个命令，减少出错概率。"'
        }
      ]
    },
    {
      id: 'ch13-5',
      title: '异常处理',
      description: 'ZERO: "数据库操作不是总是一帆风顺的。函数可能遇到除零错误、约束违反、类型不匹配……优雅地处理异常，才是健壮系统的标志。"',
      initSql: FULL_WORLD_WITH_BUILDINGS_SQL,
      defaultSql: `SELECT safe_divide(100, 0);`,
      tasks: [
        {
          prompt: `ZERO: "创建函数 safe_divide——安全除法，除数为零时返回 NULL 而不是报错。"\n\n创建函数 safe_divide(a NUMERIC, b NUMERIC) RETURNS NUMERIC：\n- 使用 EXCEPTION WHEN division_by_zero 捕获除零错误\n- 除零时返回 NULL，否则返回 a/b\n- 语言 PL/pgSQL`,
          answerSql: `CREATE OR REPLACE FUNCTION safe_divide(a NUMERIC, b NUMERIC)
RETURNS NUMERIC
LANGUAGE plpgsql AS $$
BEGIN
  RETURN a / b;
EXCEPTION
  WHEN division_by_zero THEN
    RETURN NULL;
END;
$$;`,
          checkSql: `SELECT proname FROM pg_proc WHERE proname = 'safe_divide';`,
          needsTransaction: true,
          hints: [
            'EXCEPTION 块在 BEGIN ... END 之间捕获错误',
            'WHEN division_by_zero 捕获除零错误',
            'CREATE OR REPLACE FUNCTION safe_divide(a NUMERIC, b NUMERIC) RETURNS NUMERIC LANGUAGE plpgsql AS $$ BEGIN RETURN a / b; EXCEPTION WHEN division_by_zero THEN RETURN NULL; END; $$;'
          ],
          successStory: 'ZERO: "safe_divide(100, 0) 返回 NULL 而不是崩溃——这就是防御性编程。EXCEPTION 块让函数在遇到错误时不崩溃，而是优雅降级。"'
        },
        {
          prompt: `ZERO: "更进一步——创建带验证和警告的更新函数。如果薪资为负数，抛出异常；如果薪资超过 100000，发出警告继续执行。"\n\n创建函数 safe_update_salary(p_citizen_id INTEGER, p_new_salary NUMERIC) RETURNS TEXT：\n- 如果 p_new_salary < 0，RAISE EXCEPTION '薪资不能为负数'\n- 如果 p_new_salary > 100000，RAISE NOTICE '警告：高薪任命'\n- UPDATE citizens SET salary = p_new_salary WHERE id = p_citizen_id\n- 返回 '更新成功'`,
          answerSql: `CREATE OR REPLACE FUNCTION safe_update_salary(p_citizen_id INTEGER, p_new_salary NUMERIC)
RETURNS TEXT
LANGUAGE plpgsql AS $$
BEGIN
  IF p_new_salary < 0 THEN
    RAISE EXCEPTION '薪资不能为负数';
  END IF;
  IF p_new_salary > 100000 THEN
    RAISE NOTICE '警告：高薪任命，ID=%，薪资=%', p_citizen_id, p_new_salary;
  END IF;
  UPDATE citizens SET salary = p_new_salary WHERE id = p_citizen_id;
  RETURN '更新成功';
END;
$$;`,
          checkSql: `SELECT proname FROM pg_proc WHERE proname = 'safe_update_salary';`,
          needsTransaction: true,
          hints: [
            'RAISE EXCEPTION 会中止事务，RAISE NOTICE 只输出警告不中止',
            '% 是占位符，用于格式化输出消息',
            'CREATE OR REPLACE FUNCTION safe_update_salary(p_citizen_id INTEGER, p_new_salary NUMERIC) RETURNS TEXT LANGUAGE plpgsql AS $$ BEGIN ... END; $$;'
          ],
          successStory: 'ZERO: "从简单函数到返回表，从触发器到存储过程，再到异常处理——你已经掌握了 PostgreSQL 编程的完整武器库。函数封装查询，触发器自动响应，存储过程批量操作，异常处理保障健壮性。这是数据库自动化的四重防线。"'
        }
      ]
    }
  ]
}