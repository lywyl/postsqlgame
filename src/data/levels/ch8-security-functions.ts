import type { Chapter } from '../../types'
import { FULL_WORLD_ALL_SQL } from '../world/init'

export const ch8: Chapter = {
  id: 'ch8',
  title: '第 8 章：自动化防线',
  description: '安全、函数与核心对决：角色/权限/RLS / 函数/触发器 / JSON / 综合调优',
  icon: '🛡️',
  levels: [
    {
      id: 'ch8-1',
      title: '角色创建',
      description: 'Alice: "市长 Orion 要求建立严格的安全体系。第一步，我们需要创建不同的角色账号——分析员、管理员、只读用户。每个角色将有不同的权限边界。"',
      initSql: FULL_WORLD_ALL_SQL,
      defaultSql: "CREATE ROLE analyst WITH LOGIN PASSWORD 'analyst123';",
      tasks: [
        {
          prompt: '📋 数据参考：角色管理（CREATE ROLE / ALTER ROLE）\n\nAlice: "安全堡垒的第一层是身份认证。我们需要为不同职能的人员创建数据库角色。"\n\n创建三个登录角色：\n1. analyst（分析员）- 密码 \'analyst123\'\n2. admin（管理员）- 密码 \'admin456\'\n3. readonly（只读用户）- 密码 \'read123\'\n\n每个角色都需要 WITH LOGIN 属性才能连接数据库。',
          answerSql: "CREATE ROLE analyst WITH LOGIN PASSWORD 'analyst123';\nCREATE ROLE admin WITH LOGIN PASSWORD 'admin456';\nCREATE ROLE readonly WITH LOGIN PASSWORD 'read123';",
          checkSql: "SELECT rolname FROM pg_roles WHERE rolname IN ('analyst', 'admin', 'readonly') ORDER BY rolname;",
          hints: [
            "CREATE ROLE 角色名 WITH LOGIN PASSWORD '密码'; 创建可登录角色",
            "多条 CREATE ROLE 语句用分号分隔，可以一次执行",
            "CREATE ROLE analyst WITH LOGIN PASSWORD 'analyst123';\nCREATE ROLE admin WITH LOGIN PASSWORD 'admin456';\nCREATE ROLE readonly WITH LOGIN PASSWORD 'read123';"
          ],
          needsTransaction: true,
          successStory: 'Alice: "三个角色已创建。在 PGlite 的单连接模式下，这些角色主要用于教学演示，但角色和权限的语法是标准的 PostgreSQL。"'
        },
        {
          prompt: '📋 数据参考：角色管理（ALTER ROLE / GRANT）\n\nAlice: "现在让我们修改角色属性，赋予他们特定的能力。"\n\n执行以下修改：\n1. 为 analyst 角色设置默认搜索路径为 public：ALTER ROLE analyst SET search_path TO public;\n2. 赋予 admin 角色创建数据库的权限：ALTER ROLE admin CREATEDB;\n\n完成后查询 pg_roles 验证属性已生效。',
          answerSql: "ALTER ROLE analyst SET search_path TO public;\nALTER ROLE admin CREATEDB;",
          checkSql: "SELECT rolname, rolcreatedb FROM pg_roles WHERE rolname IN ('analyst', 'admin') ORDER BY rolname;",
          hints: [
            "ALTER ROLE 角色名 SET 参数 TO 值; 设置角色级配置参数",
            "ALTER ROLE 角色名 CREATEDB; 赋予创建数据库的权限",
            "ALTER ROLE analyst SET search_path TO public;\nALTER ROLE admin CREATEDB;"
          ],
          needsTransaction: true,
          successStory: 'Alice: "角色属性已更新。analyst 现在有了默认搜索路径，admin 获得了创建数据库的能力。"'
        }
      ]
    },
    {
      id: 'ch8-2',
      title: '权限分配',
      description: 'Mayor Orion: "光有角色不够！我要精确控制谁能看什么、谁能改什么。分析员只能查询，管理员才能修改——这是我的数据，我要绝对掌控！"',
      initSql: FULL_WORLD_ALL_SQL + `\nCREATE ROLE analyst WITH LOGIN PASSWORD 'analyst123';\nCREATE ROLE admin WITH LOGIN PASSWORD 'admin456';\nCREATE ROLE readonly WITH LOGIN PASSWORD 'read123';`,
      defaultSql: "GRANT SELECT ON citizens TO analyst;",
      tasks: [
        {
          prompt: '📋 数据参考：表 citizens (id, name, age, district_id, job, salary) / 表 districts (id, district_name)\n\nMayor Orion: "给我建立权限规则！分析员只能查看数据，管理员拥有完全控制权。"\n\n执行以下授权：\n1. 授予 analyst 对 citizens 表的 SELECT 权限\n2. 授予 analyst 对 districts 表的 SELECT 权限\n3. 授予 admin 对 citizens 表的所有权限（ALL）\n\n使用 GRANT 语句完成这些授权。',
          answerSql: "GRANT SELECT ON citizens TO analyst;\nGRANT SELECT ON districts TO analyst;\nGRANT ALL ON citizens TO admin;",
          checkSql: "SELECT grantee, table_name, privilege_type FROM information_schema.role_table_grants WHERE grantee IN ('analyst', 'admin') AND table_name IN ('citizens', 'districts') ORDER BY grantee, table_name, privilege_type;",
          hints: [
            "GRANT 权限 ON 表名 TO 角色名; 授予表级权限",
            "ALL 表示所有权限（SELECT, INSERT, UPDATE, DELETE等）",
            "GRANT SELECT ON citizens TO analyst;\nGRANT SELECT ON districts TO analyst;\nGRANT ALL ON citizens TO admin;"
          ],
          needsTransaction: true,
          successStory: 'Mayor Orion: "很好！权限已分配。analyst 现在只能读取 citizens 和 districts 表，而 admin 拥有 citizens 表的完全控制权。"'
        },
        {
          prompt: '📋 数据参考：表 citizens (id, name, age, district_id, job, salary)\n\nAlice: "使用 REVOKE 撤销 analyst 对 citizens 表的 INSERT、UPDATE、DELETE 权限，只保留 SELECT。"',
          answerSql: "REVOKE INSERT, UPDATE, DELETE ON citizens FROM analyst;",
          checkSql: "SELECT privilege_type FROM information_schema.role_table_grants WHERE grantee = 'analyst' AND table_name = 'citizens' ORDER BY privilege_type;",
          hints: [
            "REVOKE 权限 ON 表名 FROM 角色名; 撤销权限",
            "可以一次撤销多个权限，用逗号分隔",
            "REVOKE INSERT, UPDATE, DELETE ON citizens FROM analyst;"
          ],
          needsTransaction: true,
          successStory: 'Alice: "权限已修正。权限管理的核心原则是最小权限原则——只给用户完成工作所需的最小权限集合。"'
        }
      ]
    },
    {
      id: 'ch8-3',
      title: '行级安全',
      description: 'Mayor Orion: "还不够！我要更细粒度的控制——东区管理员只能看到东区的数据！给我实现行级安全策略！"',
      initSql: FULL_WORLD_ALL_SQL,
      defaultSql: "ALTER TABLE citizens ENABLE ROW LEVEL SECURITY;",
      tasks: [
        {
          prompt: '📋 数据参考：表 citizens (id, name, age, district_id, job, salary)\n\nMayor Orion: "行级安全（RLS）可以控制用户能看到哪些行。我要让东区管理员只能查询东区居民！"\n\n执行以下操作：\n1. 在 citizens 表上启用行级安全\n2. 创建策略 east_district_policy：只允许查询 district_id = 1（东区）的行',
          answerSql: "ALTER TABLE citizens ENABLE ROW LEVEL SECURITY;\nCREATE POLICY east_district_policy ON citizens FOR SELECT USING (district_id = 1);",
          checkSql: "SELECT policyname, tablename, cmd, qual FROM pg_policies WHERE tablename = 'citizens';",
          hints: [
            "ALTER TABLE 表名 ENABLE ROW LEVEL SECURITY; 启用行级安全",
            "CREATE POLICY 策略名 ON 表名 FOR 操作 USING (条件); 创建访问策略",
            "ALTER TABLE citizens ENABLE ROW LEVEL SECURITY;\nCREATE POLICY east_district_policy ON citizens FOR SELECT USING (district_id = 1);"
          ],
          needsTransaction: true,
          successStory: 'Mayor Orion: "RLS 已启用，策略已创建。在真实的多用户环境中，这条策略会强制过滤查询结果。"'
        },
        {
          prompt: '📋 数据参考：表 citizens (id, name, age, district_id, job, salary)\n\nAlice: "创建策略 manager_policy：允许对 citizens 表执行所有操作，但限制只能操作 district_id 在 1、2、3 范围内的行。"',
          answerSql: "CREATE POLICY manager_policy ON citizens FOR ALL USING (district_id IN (1, 2, 3)) WITH CHECK (district_id IN (1, 2, 3));",
          checkSql: "SELECT policyname FROM pg_policies WHERE tablename = 'citizens' ORDER BY policyname;",
          hints: [
            "FOR ALL 表示策略适用于所有操作",
            "USING 控制可见行，WITH CHECK 控制可插入/更新的行",
            "CREATE POLICY manager_policy ON citizens FOR ALL USING (district_id IN (1, 2, 3)) WITH CHECK (district_id IN (1, 2, 3));"
          ],
          needsTransaction: true,
          successStory: 'Alice: "行级安全让同一张表对不同用户呈现不同的数据视图——这是多租户系统的核心技术。"'
        }
      ]
    },
    {
      id: 'ch8-4',
      title: '自定义函数',
      description: 'Alice: "手动查询太慢了——我们需要自动化工具，把常用查询封装成函数，一键调用。PL/pgSQL 是 PostgreSQL 的编程语言。"',
      initSql: FULL_WORLD_ALL_SQL,
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
          prompt: '📋 数据参考：表 citizens (id, name, age, district_id, job, salary) / 表 districts (id, district_name)\n\nAlice: "函数把常用查询封装成可复用的单元。"\n\n创建函数 get_district_stats：\n- 接收参数 p_district_id（区编号）\n- 返回 TABLE(district_name TEXT, citizen_count BIGINT, avg_salary NUMERIC)\n- 内部查询该区的居民数量和平均薪资\n\n创建后调用：SELECT * FROM get_district_stats(1);',
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
            'RETURNS TABLE(列名 类型, ...) 定义返回表结构',
            'RETURN QUERY + SELECT 填充结果'
          ],
          successStory: 'Alice: "函数创建成功。调用 get_district_stats(1) 就能立即看到东区的统计数据——不用再写一长串 SQL。"'
        },
        {
          prompt: '📋 数据参考：表 citizens (id, name, age, district_id, job, salary)\n\nAlice: "创建函数 high_earners(min_salary NUMERIC)，返回 SETOF citizens（所有薪资超过 min_salary 的市民）。"',
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
            'RETURNS SETOF 表名 让函数返回该表的行子集',
            'RETURN QUERY SELECT ... 直接返回查询结果',
            'CREATE OR REPLACE FUNCTION high_earners(min_salary NUMERIC) RETURNS SETOF citizens LANGUAGE plpgsql AS $$ BEGIN RETURN QUERY SELECT * FROM citizens WHERE salary > min_salary; END; $$;'
          ],
          successStory: 'Alice: "SETOF 更简洁——直接说返回 citizens 的行子集即可。函数让复杂数据触手可及。"'
        }
      ]
    },
    {
      id: 'ch8-5',
      title: '触发器',
      description: 'ZERO: "触发器是数据库的自动驾驶系统——当特定事件发生时，触发器自动执行预设逻辑。薪资变更时自动记录审计日志？触发器帮你盯着。"',
      initSql: FULL_WORLD_ALL_SQL + `
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
          prompt: '📋 数据参考：表 citizens (id, name, age, district_id, job, salary) / 表 audit_log (id, table_name, operation, old_data, new_data, operator, operated_at)\n\n创建触发器函数 log_salary_change()：\n- RETURNS TRIGGER\n- 当 TG_OP = \'UPDATE\' 且 OLD.salary != NEW.salary 时\n- 向 audit_log 插入一条记录\n- 返回 NEW\n\n然后创建触发器 trg_salary_audit',
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
            'CREATE TRIGGER 触发器名 AFTER UPDATE ON 表名 FOR EACH ROW EXECUTE FUNCTION 函数名();'
          ],
          successStory: 'ZERO: "触发器已激活。从现在起，任何对 citizens 表 salary 列的修改都会被自动记录到 audit_log 表。"'
        },
        {
          prompt: '📋 数据参考：表 citizens (id, name, age, district_id, job, salary) / 表 audit_log (id, table_name, operation, old_data, new_data, operator, operated_at)\n\n测试触发器——修改某个市民的薪资，然后检查 audit_log 是否有记录。\n\n将 id=1 的市民薪资增加 10%，然后查询 audit_log 表的最后一条记录。',
          answerSql: `UPDATE citizens SET salary = salary * 1.1 WHERE id = 1;
SELECT * FROM audit_log ORDER BY id DESC LIMIT 1;`,
          checkSql: `SELECT count(*) FROM audit_log WHERE table_name = 'citizens' AND operation = 'UPDATE';`,
          needsTransaction: true,
          hints: [
            '触发器会在 UPDATE 执行后自动触发，你不需要手动调用',
            'UPDATE citizens SET salary = salary * 1.1 WHERE id = 1; 然后查询 audit_log'
          ],
          successStory: 'ZERO: "审计日志已自动记录！old_data 保存了修改前的薪资，new_data 保存了修改后的薪资。"'
        }
      ]
    },
    {
      id: 'ch8-6',
      title: '存储过程',
      description: 'Alice: "存储过程（PROCEDURE）更强——它可以在一个调用里执行多条 SQL，适合批量操作。"',
      initSql: FULL_WORLD_ALL_SQL,
      defaultSql: `CALL transfer_citizens(2, 1, 3);`,
      tasks: [
        {
          prompt: '📋 数据参考：表 citizens (id, name, age, district_id, job, salary)\n\n创建存储过程 transfer_citizens(p_from_district INTEGER, p_to_district INTEGER, p_count INTEGER)：\n- 把 citizens 表中 district_id = p_from_district 的前 p_count 个市民迁移到 p_to_district',
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
            'PROCEDURE 用 CALL 调用，不像 FUNCTION 用 SELECT'
          ],
          successStory: 'Alice: "存储过程把复杂操作封装成一键调用。批量迁移再也不用手动一条条写了。"'
        },
        {
          prompt: '📋 数据参考：表 citizens (id, name, age, district_id, job, salary)\n\n创建存储过程 bulk_raise(p_percent NUMERIC)：给所有市民按百分比加薪。',
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
            '百分比转小数：1 + p_percent / 100'
          ],
          successStory: 'Alice: "批量加薪一键完成。存储过程是运维自动化的利器。"'
        }
      ]
    },
    {
      id: 'ch8-7',
      title: 'JSON 基础',
      description: 'ZERO: "市长 Orion 把机密信息藏在了居民的 profile 字段里——那是一个 JSONB 列。要提取这些情报，你需要学会在 JSON 迷宫中导航。"',
      initSql: FULL_WORLD_ALL_SQL + `
ALTER TABLE citizens ADD COLUMN IF NOT EXISTS profile JSONB;
UPDATE citizens SET 
  profile = jsonb_build_object(
    'level', (id % 5 + 1),
    'department', job,
    'clearance', CASE WHEN salary > 25000 THEN 'top_secret' WHEN salary > 15000 THEN 'confidential' ELSE 'public' END,
    'projects', jsonb_build_array('project_' || (id % 3 + 1), 'project_' || (id % 4 + 5))
  )
WHERE profile IS NULL;
`,
      defaultSql: "SELECT name, profile->>'department' as dept, profile->>'clearance' as clearance FROM citizens WHERE profile IS NOT NULL ORDER BY salary DESC LIMIT 10;",
      tasks: [
        {
          prompt: '📋 数据参考：表 citizens (id, name, age, district_id, job, salary, profile) — profile 为 JSONB 类型\n\nZERO: "JSONB 数据就像嵌套的保险箱。->> 操作符可以提取文本值。"\n\n查询所有有 profile 数据的居民，显示姓名、部门（profile->>\'department\'）和安全等级（profile->>\'clearance\'），按薪水降序排列，取前10条。',
          answerSql: "SELECT name, profile->>'department' as dept, profile->>'clearance' as clearance FROM citizens WHERE profile IS NOT NULL ORDER BY salary DESC LIMIT 10;",
          hints: [
            "->> 操作符提取 JSONB 字段的文本值：profile->>'key'",
            "使用别名让输出更清晰：profile->>'department' as dept",
            "SELECT name, profile->>'department' as dept, profile->>'clearance' as clearance FROM citizens WHERE profile IS NOT NULL ORDER BY salary DESC LIMIT 10;"
          ],
          successStory: 'ZERO: "JSON 解析成功。profile->>\'clearance\' 提取出了安全等级——top_secret、confidential、public。看来 Orion 把最高机密藏在了高薪居民的档案里。"'
        },
        {
          prompt: '📋 数据参考：表 citizens (id, name, age, district_id, job, salary, profile) — profile 为 JSONB 类型\n\nZERO: "@> 操作符可以检查 JSONB 是否包含特定的键值对。找出所有拥有 top_secret 安全等级的居民。"\n\n使用 @> 操作符查询 profile 中包含 {"clearance": "top_secret"} 的居民，显示姓名和薪水。',
          answerSql: "SELECT name, salary FROM citizens WHERE profile @> '{\"clearance\": \"top_secret\"}'::jsonb;",
          hints: [
            "@> 是 JSONB 包含操作符：检查左侧 JSONB 是否包含右侧的键值对",
            "右侧需要用 ::jsonb 转换为 JSONB 类型",
            "SELECT name, salary FROM citizens WHERE profile @> '{\"clearance\": \"top_secret\"}'::jsonb;"
          ],
          successStory: 'ZERO: "找到了！这些 top_secret 级别的居民都是城市的高层——CTO、副总、总经理。Orion 的机密网络正在浮出水面。"'
        }
      ]
    },
    {
      id: 'ch8-8',
      title: '终极博弈',
      description: `Mayor Orion: "所有系统同时报警！表膨胀、慢查询、锁等待——所有问题同时爆发！这是最终的考验！"\n\nZERO & Alice: "这是你的最终试炼。运用你所学的全部知识——VACUUM、ANALYZE、索引优化、系统诊断——全面修复这座城市的数据库！"`,
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
          prompt: `📋 数据参考：视图 pg_stat_user_tables (relname, n_live_tup, n_dead_tup)\n\n【任务 1/2：诊断表膨胀】\n\n查询 pg_stat_user_tables，显示所有用户表的死元组情况，并标注健康状态：\n- relname（表名）\n- n_live_tup（活元组数）\n- n_dead_tup（死元组数）\n- bloat_status：死元组 > 活元组为 'CRITICAL'，死元组 > 0 为 'WARNING'，否则为 'OK'`,
          answerSql: `SELECT relname, n_live_tup, n_dead_tup, CASE WHEN n_dead_tup > n_live_tup THEN 'CRITICAL' WHEN n_dead_tup > 0 THEN 'WARNING' ELSE 'OK' END AS bloat_status FROM pg_stat_user_tables ORDER BY n_dead_tup DESC;`,
          hints: [
            '使用 CASE WHEN ... THEN ... WHEN ... THEN ... ELSE ... END 实现条件判断',
            'CRITICAL > WARNING > OK 的优先级顺序',
            'SELECT relname, n_live_tup, n_dead_tup, CASE WHEN n_dead_tup > n_live_tup THEN \'CRITICAL\' WHEN n_dead_tup > 0 THEN \'WARNING\' ELSE \'OK\' END AS bloat_status FROM pg_stat_user_tables ORDER BY n_dead_tup DESC;'
          ],
          successStory: 'ZERO: "诊断完成！通过 pg_stat_user_tables 我们可以看到哪些表需要 VACUUM。那些标记为 CRITICAL 的表死元组数超过了活元组数，这是最紧急需要处理的情况。"'
        },
        {
          prompt: `📋 数据参考：表 citizens (id, name, age, district_id, job, salary) / 表 transactions (id, citizen_id, amount, type, description, created_at) / 表 diagnostic_events (id, event_type, severity, created_at)\n\n【任务 2/2：清理与优化】\n\n执行以下操作：\n1. VACUUM ANALYZE citizens 表\n2. VACUUM ANALYZE transactions 表\n3. VACUUM ANALYZE diagnostic_events 表\n4. 查询 pg_stat_user_tables，显示这三个表的 live/dead 元组统计`,
          answerSql: `VACUUM ANALYZE citizens;
VACUUM ANALYZE transactions;
VACUUM ANALYZE diagnostic_events;
SELECT relname, n_live_tup, n_dead_tup FROM pg_stat_user_tables WHERE relname IN ('citizens', 'transactions', 'diagnostic_events') ORDER BY relname;`,
          checkSql: `SELECT 1 AS optimized;`,
          needsTransaction: true,
          hints: [
            'VACUUM ANALYZE 是 VACUUM 和 ANALYZE 的组合，清理死元组并更新统计信息',
            '关键业务表应该定期执行 VACUUM ANALYZE',
            'VACUUM ANALYZE citizens; VACUUM ANALYZE transactions; VACUUM ANALYZE diagnostic_events;'
          ],
          successStory: `🏆 **FINAL VICTORY - 终极胜利** 🏆

*系统的警报声渐渐平息，屏幕上的红色警告一个个消失，取而代之的是清新的绿色状态指示。*

**Mayor Orion**（激动地握住你的手）："你做到了！你真的做到了！这座城市的数据库系统——我视若珍宝的数字心脏——在你手中重获新生！"

**Alice**（眼中闪烁着光芒）："从第一章的基础 SELECT 查询，到如今能够诊断和修复复杂的数据库危机……看着你一步步成长，是我作为 AI 助手最大的荣幸。你现在已经掌握了：

✨ 数据查询的艺术（Ch1-3）
✨ 数据定义与操作（Ch4-5）
✨ 索引与查询优化（Ch6）
✨ MVCC、事务与持久化（Ch7）
✨ 安全、函数与综合调优（Ch8）

你是一位真正的 PostgreSQL 大师了！"

**ZERO**（难得地露出微笑）："我承认，最初我对人类学习数据库持怀疑态度。但你证明了，只要有决心和正确的指导，任何人都能掌握这些复杂的概念。"

*城市的灯光重新亮起，所有系统的仪表盘都显示着健康的绿色。*

**Mayor Orion**："从今天起，你不仅是这座城市的正式数据库管理员，更是我们所有人的技术导师。"

**Alice & ZERO**（异口同声）："恭喜你完成《PostgreSQL 探秘：从零到大师》的全部旅程！愿数据与你同在！"

🎮 **游戏通关！你已掌握 PostgreSQL 的核心技能！** 🎮`
        }
      ]
    }
  ]
}
