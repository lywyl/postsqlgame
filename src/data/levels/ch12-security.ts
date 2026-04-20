// TODO: 未启用章节，章节 ID 需重新编号后才能接入 chapters.ts
import type { Chapter } from '../../types'
import { FULL_WORLD_WITH_BUILDINGS_SQL } from '../world/init'

export const ch12: Chapter = {
  id: 'ch12',
  title: '第 12 章：安全堡垒',
  description: '权限与安全：角色创建 / 权限分配 / 角色继承 / 行级安全',
  icon: '🛡️',
  levels: [
    {
      id: 'ch12-1',
      title: '角色创建',
      description: 'Alice: "市长 Orion 要求建立严格的安全体系。第一步，我们需要创建不同的角色账号——分析员、管理员、只读用户。每个角色将有不同的权限边界。"',
      initSql: FULL_WORLD_WITH_BUILDINGS_SQL,
      defaultSql: "CREATE ROLE analyst WITH LOGIN PASSWORD 'analyst123';",
      tasks: [
        {
          prompt: 'Alice: "安全堡垒的第一层是身份认证。我们需要为不同职能的人员创建数据库角色。"\n\n创建三个登录角色：\n1. analyst（分析员）- 密码 \'analyst123\'\n2. admin（管理员）- 密码 \'admin456\'\n3. readonly（只读用户）- 密码 \'read123\'\n\n每个角色都需要 WITH LOGIN 属性才能连接数据库。',
          answerSql: "CREATE ROLE analyst WITH LOGIN PASSWORD 'analyst123';\nCREATE ROLE admin WITH LOGIN PASSWORD 'admin456';\nCREATE ROLE readonly WITH LOGIN PASSWORD 'read123';",
          checkSql: "SELECT rolname FROM pg_roles WHERE rolname IN ('analyst', 'admin', 'readonly') ORDER BY rolname;",
          hints: [
            "CREATE ROLE 角色名 WITH LOGIN PASSWORD '密码'; 创建可登录角色",
            "多条 CREATE ROLE 语句用分号分隔，可以一次执行",
            "CREATE ROLE analyst WITH LOGIN PASSWORD 'analyst123';\nCREATE ROLE admin WITH LOGIN PASSWORD 'admin456';\nCREATE ROLE readonly WITH LOGIN PASSWORD 'read123';"
          ],
          needsTransaction: true,
          successStory: 'Alice: "三个角色已创建。注意——在 PGlite 的单连接模式下，这些角色主要用于教学演示，真实的权限隔离在多连接环境下才会完全生效。但角色和权限的语法是标准的 PostgreSQL。"'
        },
        {
          prompt: 'Alice: "现在让我们修改角色属性，赋予他们特定的能力。"\n\n执行以下修改：\n1. 为 analyst 角色设置默认搜索路径为 public：ALTER ROLE analyst SET search_path TO public;\n2. 赋予 admin 角色创建数据库的权限：ALTER ROLE admin CREATEDB;\n\n完成后查询 pg_roles 验证属性已生效。',
          answerSql: "ALTER ROLE analyst SET search_path TO public;\nALTER ROLE admin CREATEDB;",
          checkSql: "SELECT rolname, rolcreatedb FROM pg_roles WHERE rolname IN ('analyst', 'admin') ORDER BY rolname;",
          hints: [
            "ALTER ROLE 角色名 SET 参数 TO 值; 设置角色级配置参数",
            "ALTER ROLE 角色名 CREATEDB; 赋予创建数据库的权限",
            "ALTER ROLE analyst SET search_path TO public;\nALTER ROLE admin CREATEDB;"
          ],
          needsTransaction: true,
          successStory: 'Alice: "角色属性已更新。analyst 现在有了默认搜索路径，admin 获得了创建数据库的能力。这些属性会在角色登录时生效。"'
        }
      ]
    },
    {
      id: 'ch12-2',
      title: '权限分配',
      description: 'Mayor Orion: "光有角色不够！我要精确控制谁能看什么、谁能改什么。分析员只能查询，管理员才能修改——这是我的数据，我要绝对掌控！"',
      initSql: FULL_WORLD_WITH_BUILDINGS_SQL + `\nCREATE ROLE analyst WITH LOGIN PASSWORD 'analyst123';\nCREATE ROLE admin WITH LOGIN PASSWORD 'admin456';\nCREATE ROLE readonly WITH LOGIN PASSWORD 'read123';`,
      defaultSql: "GRANT SELECT ON citizens TO analyst;",
      tasks: [
        {
          prompt: 'Mayor Orion: "给我建立权限规则！分析员只能查看数据，管理员拥有完全控制权。"\n\n执行以下授权：\n1. 授予 analyst 对 citizens 表的 SELECT 权限\n2. 授予 analyst 对 districts 表的 SELECT 权限\n3. 授予 admin 对 citizens 表的所有权限（ALL）\n\n使用 GRANT 语句完成这些授权。',
          answerSql: "GRANT SELECT ON citizens TO analyst;\nGRANT SELECT ON districts TO analyst;\nGRANT ALL ON citizens TO admin;",
          checkSql: "SELECT grantee, table_name, privilege_type FROM information_schema.role_table_grants WHERE grantee IN ('analyst', 'admin') AND table_name IN ('citizens', 'districts') ORDER BY grantee, table_name, privilege_type;",
          hints: [
            "GRANT 权限 ON 表名 TO 角色名; 授予表级权限",
            "ALL 表示所有权限（SELECT, INSERT, UPDATE, DELETE等）",
            "GRANT SELECT ON citizens TO analyst;\nGRANT SELECT ON districts TO analyst;\nGRANT ALL ON citizens TO admin;"
          ],
          needsTransaction: true,
          successStory: 'Mayor Orion: "很好！权限已分配。analyst 现在只能读取 citizens 和 districts 表，而 admin 拥有 citizens 表的完全控制权。记住——在真实的多用户环境中，这些权限会严格 enforced。"'
        },
        {
          prompt: 'Alice: "等等，我刚才检查权限时发现 analyst 对 citizens 表有 INSERT、UPDATE、DELETE 权限？这不对，分析员应该是只读的。"\n\n使用 REVOKE 语句撤销 analyst 对 citizens 表的 INSERT、UPDATE、DELETE 权限，只保留 SELECT。',
          answerSql: "REVOKE INSERT, UPDATE, DELETE ON citizens FROM analyst;",
          checkSql: "SELECT privilege_type FROM information_schema.role_table_grants WHERE grantee = 'analyst' AND table_name = 'citizens' ORDER BY privilege_type;",
          hints: [
            "REVOKE 权限 ON 表名 FROM 角色名; 撤销权限",
            "可以一次撤销多个权限，用逗号分隔",
            "REVOKE INSERT, UPDATE, DELETE ON citizens FROM analyst;"
          ],
          needsTransaction: true,
          successStory: 'Alice: "权限已修正。现在 analyst 对 citizens 表只有 SELECT 权限。权限管理的核心原则是最小权限原则——只给用户完成工作所需的最小权限集合。"'
        }
      ]
    },
    {
      id: 'ch12-3',
      title: '角色继承',
      description: 'Alice: "逐个给用户授权太繁琐了。PostgreSQL 支持角色继承——我们可以创建角色组，把权限赋给组，再把用户加入组。这样权限管理就像搭积木一样简单。"',
      initSql: FULL_WORLD_WITH_BUILDINGS_SQL + `\nCREATE ROLE analyst WITH LOGIN PASSWORD 'analyst123';\nCREATE ROLE admin WITH LOGIN PASSWORD 'admin456';\nCREATE ROLE readonly WITH LOGIN PASSWORD 'read123';\nGRANT SELECT ON citizens TO analyst;\nGRANT SELECT ON districts TO analyst;\nGRANT ALL ON citizens TO admin;`,
      defaultSql: "GRANT readonly TO analyst;",
      tasks: [
        {
          prompt: 'Alice: "让我们建立角色层级。readonly 是基础只读角色，analyst 继承 readonly 的权限，admin 再继承 analyst 的权限——形成一条权限链。"\n\n执行以下角色继承设置：\n1. 将 readonly 角色授予 analyst（analyst 继承 readonly 的权限）\n2. 将 analyst 角色授予 admin（admin 继承 analyst 的权限）\n\n使用 GRANT role TO user 语法。',
          answerSql: "GRANT readonly TO analyst;\nGRANT analyst TO admin;",
          checkSql: "SELECT roleid::regrole AS parent_role, member::regrole AS member_role FROM pg_auth_members WHERE roleid::regrole::text IN ('readonly', 'analyst') ORDER BY roleid::regrole::text;",
          hints: [
            "GRANT 角色名 TO 用户名; 让后者继承前者的权限",
            "角色继承形成层级结构，子角色自动拥有父角色的所有权限",
            "GRANT readonly TO analyst;\nGRANT analyst TO admin;"
          ],
          needsTransaction: true,
          successStory: 'Alice: "角色层级已建立。现在 analyst 拥有 readonly 的权限，admin 拥有 analyst 和 readonly 的权限。这种设计让权限管理变得模块化——修改组权限，所有成员自动生效。"'
        },
        {
          prompt: 'Alice: "现在让我们创建一个专门的角色组来管理数据访问权限。"\n\n执行以下操作：\n1. 创建角色 data_viewer（不需要 LOGIN，这是一个组角色）\n2. 授予 data_viewer 对 citizens 表的 SELECT 权限\n3. 授予 data_viewer 对 districts 表的 SELECT 权限\n4. 将 data_viewer 角色授予 readonly\n\n这样 readonly 用户就通过继承获得了对所有城市数据的查询权限。',
          answerSql: "CREATE ROLE data_viewer;\nGRANT SELECT ON citizens TO data_viewer;\nGRANT SELECT ON districts TO data_viewer;\nGRANT data_viewer TO readonly;",
          checkSql: "SELECT grantee, table_name FROM information_schema.role_table_grants WHERE grantee = 'data_viewer' ORDER BY table_name;",
          hints: [
            "组角色通常不需要 LOGIN 属性，用于聚合权限",
            "GRANT 组角色 TO 用户 让用户继承组的所有权限",
            "CREATE ROLE data_viewer;\nGRANT SELECT ON citizens TO data_viewer;\nGRANT SELECT ON districts TO data_viewer;\nGRANT data_viewer TO readonly;"
          ],
          needsTransaction: true,
          successStory: 'Alice: "权限组设计完成。data_viewer 是一个纯粹的权限容器，readonly 通过继承获得了查询 citizens 和 districts 的能力。这是企业级权限管理的最佳实践——用角色组封装业务权限，再分配给具体用户。"'
        }
      ]
    },
    {
      id: 'ch12-4',
      title: '行级安全',
      description: 'Mayor Orion: "还不够！我要更细粒度的控制——东区管理员只能看到东区的数据！这是最高级别的安全要求，给我实现行级安全策略！"',
      initSql: FULL_WORLD_WITH_BUILDINGS_SQL,
      defaultSql: "ALTER TABLE citizens ENABLE ROW LEVEL SECURITY;",
      tasks: [
        {
          prompt: 'Mayor Orion: "行级安全（RLS）是 PostgreSQL 的高级安全特性，可以控制用户能看到哪些行。我要让东区管理员只能查询东区居民！"\n\n执行以下操作：\n1. 在 citizens 表上启用行级安全：ALTER TABLE citizens ENABLE ROW LEVEL SECURITY;\n2. 创建策略 east_district_policy：只允许查询 district_id = 1（东区）的行\n   语法：CREATE POLICY 策略名 ON 表名 FOR SELECT USING (条件);\n\n注意：PGlite 单连接模式下 RLS 策略不会真正生效，但语法和概念是标准的。',
          answerSql: "ALTER TABLE citizens ENABLE ROW LEVEL SECURITY;\nCREATE POLICY east_district_policy ON citizens FOR SELECT USING (district_id = 1);",
          checkSql: "SELECT policyname, tablename, cmd, qual FROM pg_policies WHERE tablename = 'citizens';",
          hints: [
            "ALTER TABLE 表名 ENABLE ROW LEVEL SECURITY; 启用行级安全",
            "CREATE POLICY 策略名 ON 表名 FOR 操作 USING (条件); 创建访问策略",
            "ALTER TABLE citizens ENABLE ROW LEVEL SECURITY;\nCREATE POLICY east_district_policy ON citizens FOR SELECT USING (district_id = 1);"
          ],
          needsTransaction: true,
          successStory: 'Mayor Orion: "RLS 已启用，策略已创建。在真实的多用户 PostgreSQL 环境中，这条策略会强制过滤查询结果——用户只能看到 district_id = 1 的行。这是数据安全的最后一道防线。"'
        },
        {
          prompt: 'Alice: "让我们创建一个更复杂的策略，给高级管理员使用。"\n\n创建策略 manager_policy：\n- 允许对 citizens 表执行所有操作（FOR ALL）\n- 使用 USING 子句限制只能操作 district_id 在 1、2、3 范围内的行\n- 同时添加 WITH CHECK 子句确保插入/更新的行也符合这个范围\n\n语法：CREATE POLICY 策略名 ON 表名 FOR ALL USING (条件) WITH CHECK (条件);',
          answerSql: "CREATE POLICY manager_policy ON citizens FOR ALL USING (district_id IN (1, 2, 3)) WITH CHECK (district_id IN (1, 2, 3));",
          checkSql: "SELECT policyname FROM pg_policies WHERE tablename = 'citizens' ORDER BY policyname;",
          hints: [
            "FOR ALL 表示策略适用于 SELECT、INSERT、UPDATE、DELETE 所有操作",
            "USING 控制可见行，WITH CHECK 控制可插入/更新的行",
            "CREATE POLICY manager_policy ON citizens FOR ALL USING (district_id IN (1, 2, 3)) WITH CHECK (district_id IN (1, 2, 3));"
          ],
          needsTransaction: true,
          successStory: 'Alice: "高级策略已部署。manager_policy 让管理员只能看到和操作前三个区的数据。USING 子句控制查询可见性，WITH CHECK 确保写入的数据也符合范围。行级安全让同一张表对不同用户呈现不同的数据视图——这是多租户系统的核心技术。"\n\nMayor Orion: "安全堡垒已建立！角色、权限、继承、行级安全——我的数据终于得到了全方位的保护。ZERO，你休想渗透进来！"\n\nZERO: "哼……权限系统确实严密。但任何堡垒都有弱点，我会找到突破口。游戏还没结束，Alice。"'
        }
      ]
    }
  ]
}
