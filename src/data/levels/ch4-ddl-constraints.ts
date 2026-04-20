import type { Chapter } from '../../types'
import { FULL_WORLD_WITH_BUILDINGS_SQL } from '../world/init'

export const ch4: Chapter = {
  id: 'ch4',
  title: '第 4 章：灾后重建',
  description: 'DDL 与完整性：CREATE TABLE / ALTER TABLE / ENUM / VIEW / 约束 / 级联 / SCHEMA',
  icon: '🏗️',
  levels: [
    {
      id: 'ch4-1',
      title: '废墟之上',
      description: 'ZERO: "Alice 的清洗程序摧毁了城市的建筑档案表。没有结构，数据就无处存放。你现在拥有造物主权限——从废墟中重建数据结构！"',
      initSql: FULL_WORLD_WITH_BUILDINGS_SQL,
      defaultSql: "CREATE TABLE shelters (\n  id SERIAL PRIMARY KEY,\n  name VARCHAR(100) NOT NULL,\n  capacity INTEGER\n);",
      tasks: [
        {
          prompt: "📋 数据参考：表 districts (id, district_name)\n\n建筑档案被毁，需要重建一张避难所登记表。\n\n创建表 shelters，包含以下字段：\n- id：SERIAL PRIMARY KEY（自增主键）\n- name：VARCHAR(100) NOT NULL（名称，不能为空）\n- capacity：INTEGER（容纳人数）\n- district_id：INTEGER（所属区编号）",
          answerSql: "CREATE TABLE shelters (\n  id SERIAL PRIMARY KEY,\n  name VARCHAR(100) NOT NULL,\n  capacity INTEGER,\n  district_id INTEGER\n);",
          checkSql: "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'shelters' ORDER BY ordinal_position;",
          hints: [
            "CREATE TABLE 表名 (列名 数据类型 约束, ...);",
            "SERIAL 是自增整数，PRIMARY KEY 是主键约束，NOT NULL 表示不能为空",
            "CREATE TABLE shelters (\n  id SERIAL PRIMARY KEY,\n  name VARCHAR(100) NOT NULL,\n  capacity INTEGER,\n  district_id INTEGER\n);"
          ],
          successStory: 'ZERO: "结构已实体化。空表就像一个等待被填充的容器——现在这个世界里多了一张属于我们的表。"'
        },
        {
          prompt: '📋 数据参考：表 districts (id, district_name)\n\nZERO: "光有基础字段不够，还需要约束来保证数据质量。"\n\n创建表 supply_depots（补给站），包含：\n- id：SERIAL PRIMARY KEY\n- name：VARCHAR(100) NOT NULL\n- district_id：INTEGER NOT NULL REFERENCES districts(id)（外键约束）\n- stock_level：INTEGER DEFAULT 100（默认值100）\n- is_active：BOOLEAN DEFAULT true',
          answerSql: "CREATE TABLE supply_depots (\n  id SERIAL PRIMARY KEY,\n  name VARCHAR(100) NOT NULL,\n  district_id INTEGER NOT NULL REFERENCES districts(id),\n  stock_level INTEGER DEFAULT 100,\n  is_active BOOLEAN DEFAULT true\n);",
          checkSql: "SELECT column_name, data_type, column_default, is_nullable FROM information_schema.columns WHERE table_name = 'supply_depots' ORDER BY ordinal_position;",
          hints: [
            "REFERENCES 表名(列名) 创建外键约束，DEFAULT 值 设置默认值",
            "BOOLEAN 类型的默认值写 true 或 false（不加引号）",
            "CREATE TABLE supply_depots (\n  id SERIAL PRIMARY KEY,\n  name VARCHAR(100) NOT NULL,\n  district_id INTEGER NOT NULL REFERENCES districts(id),\n  stock_level INTEGER DEFAULT 100,\n  is_active BOOLEAN DEFAULT true\n);"
          ],
          successStory: 'ZERO: "约束是数据的护盾。外键确保每个补给站都归属于真实存在的区，DEFAULT 让插入更简洁。造物主也要懂得立规矩。"'
        }
      ]
    },
    {
      id: 'ch4-2',
      title: '扩展地基',
      description: 'ZERO: "旧的 buildings 表结构残缺，缺少关键字段。不能推倒重来——里面还有幸存的数据。用 ALTER TABLE 在原有结构上动手术！"',
      initSql: FULL_WORLD_WITH_BUILDINGS_SQL,
      defaultSql: "ALTER TABLE buildings ADD COLUMN security_level INTEGER DEFAULT 1;",
      tasks: [
        {
          prompt: '📋 数据参考：表 buildings (id, name, district_id, type, floors, area_m2, built_year, status)\n\nbuildings 表缺少安全等级字段。\n\n使用 ALTER TABLE 为 buildings 表添加一列：\n- 列名：security_level\n- 类型：INTEGER\n- 默认值：1',
          answerSql: "ALTER TABLE buildings ADD COLUMN security_level INTEGER DEFAULT 1;",
          checkSql: "SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = 'buildings' AND column_name = 'security_level';",
          hints: [
            "ALTER TABLE 表名 ADD COLUMN 列名 数据类型 DEFAULT 默认值;",
            "ALTER TABLE buildings ADD COLUMN security_level INTEGER DEFAULT 1;"
          ],
          successStory: 'ZERO: "字段追加成功，所有现有行自动填入默认值 1。ALTER TABLE 是外科手术刀——精准，不破坏现有数据。"'
        },
        {
          prompt: '📋 数据参考：表 buildings (id, name, district_id, type, floors, area_m2, built_year, status)\n\nZERO: "buildings 表里有个字段名字起错了，status 太模糊，改成 building_status 更清晰。"\n\n使用 ALTER TABLE 将 buildings 表的 status 列重命名为 building_status。',
          answerSql: "ALTER TABLE buildings RENAME COLUMN status TO building_status;",
          checkSql: "SELECT column_name FROM information_schema.columns WHERE table_name = 'buildings' AND column_name = 'building_status';",
          hints: [
            "重命名列语法：ALTER TABLE 表名 RENAME COLUMN 旧名 TO 新名;",
            "ALTER TABLE buildings RENAME COLUMN status TO building_status;"
          ],
          successStory: 'ZERO: "列名已更新。重命名不会丢失数据，只是改了标签。现在语义更清晰了。"'
        }
      ]
    },
    {
      id: 'ch4-3',
      title: '自定义类型',
      description: 'ZERO: "系统里的状态字段乱成一锅粥——有人写 active，有人写 ACTIVE，有人写 1。这种混乱会让查询崩溃。用 ENUM 类型把状态值锁死！"',
      initSql: FULL_WORLD_WITH_BUILDINGS_SQL,
      defaultSql: "CREATE TYPE building_status_enum AS ENUM ('active', 'abandoned', 'degraded', 'under_construction');",
      tasks: [
        {
          prompt: '📋 数据参考：表 buildings (id, name, district_id, type, floors, area_m2, built_year, status)\n\nZERO: "先定义枚举类型，把合法值固定下来。"\n\n使用 CREATE TYPE 创建一个枚举类型 building_status_enum，包含四个合法值：\n- active（运营中）\n- abandoned（废弃）\n- degraded（破损）\n- under_construction（建设中）',
          answerSql: "CREATE TYPE building_status_enum AS ENUM ('active', 'abandoned', 'degraded', 'under_construction');",
          checkSql: "SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname = 'building_status_enum' ORDER BY enumsortorder;",
          hints: [
            "CREATE TYPE 类型名 AS ENUM ('值1', '值2', ...);",
            "CREATE TYPE building_status_enum AS ENUM ('active', 'abandoned', 'degraded', 'under_construction');"
          ],
          successStory: 'ZERO: "枚举类型已注册到系统类型目录。现在这四个值是唯一合法的状态——任何其他字符串都会被数据库拒绝。"'
        },
        {
          prompt: '📋 数据参考：表 buildings (id, name, district_id, type, floors, area_m2, built_year, status)\n\nZERO: "有了类型，现在建一张使用它的表。"\n\n创建表 reconstruction_projects（重建项目），包含：\n- id：SERIAL PRIMARY KEY\n- building_id：INTEGER REFERENCES buildings(id)\n- project_status：building_status_enum DEFAULT \'under_construction\'（使用刚创建的枚举类型）\n- started_at：TIMESTAMP DEFAULT NOW()',
          answerSql: "CREATE TABLE reconstruction_projects (\n  id SERIAL PRIMARY KEY,\n  building_id INTEGER REFERENCES buildings(id),\n  project_status building_status_enum DEFAULT 'under_construction',\n  started_at TIMESTAMP DEFAULT NOW()\n);",
          checkSql: "SELECT column_name, udt_name FROM information_schema.columns WHERE table_name = 'reconstruction_projects' ORDER BY ordinal_position;",
          hints: [
            "使用自定义类型和使用内置类型语法相同，直接写类型名即可",
            "DEFAULT 'under_construction' 注意值必须是枚举中定义的合法值",
            "CREATE TABLE reconstruction_projects (\n  id SERIAL PRIMARY KEY,\n  building_id INTEGER REFERENCES buildings(id),\n  project_status building_status_enum DEFAULT 'under_construction',\n  started_at TIMESTAMP DEFAULT NOW()\n);"
          ],
          successStory: 'ZERO: "完美。现在任何试图插入非法状态的操作都会被数据库直接拒绝。这就是类型系统的力量——在数据入库前就把错误扼杀。"'
        }
      ]
    },
    {
      id: 'ch4-4',
      title: '安全视图',
      description: 'ZERO: "Alice 的监控系统在扫描所有对原始表的直接访问。我们需要一个中间层——视图。通过视图访问数据，让监控系统看不到真实的查询意图。"',
      initSql: FULL_WORLD_WITH_BUILDINGS_SQL,
      defaultSql: "CREATE VIEW public_buildings AS\nSELECT id, name, type, floors, district_id\nFROM buildings\nWHERE status = 'active';",
      tasks: [
        {
          prompt: '📋 数据参考：表 buildings (id, name, district_id, type, floors, area_m2, built_year, status)\n\nZERO: "创建一个只暴露安全信息的视图，隐藏敏感字段。"\n\n创建视图 public_buildings，查询 buildings 表中 status = \'active\' 的建筑，只暴露以下列：id, name, type, floors, district_id。',
          answerSql: "CREATE VIEW public_buildings AS\nSELECT id, name, type, floors, district_id\nFROM buildings\nWHERE status = 'active';",
          checkSql: "SELECT column_name FROM information_schema.columns WHERE table_name = 'public_buildings' ORDER BY ordinal_position;",
          hints: [
            "CREATE VIEW 视图名 AS SELECT ...;",
            "视图就是一个保存的查询，访问视图就像访问表一样",
            "CREATE VIEW public_buildings AS\nSELECT id, name, type, floors, district_id\nFROM buildings\nWHERE status = 'active';"
          ],
          successStory: 'ZERO: "视图已创建。现在外部查询只能看到 active 状态的建筑，area_m2、built_year 等敏感字段完全隐藏。监控系统只会看到一个无害的视图访问。"'
        },
        {
          prompt: '📋 数据参考：表 buildings (id, name, district_id, type, floors, area_m2, built_year, status)\n\nZERO: "普通视图每次查询都要重新计算。对于复杂统计，我们需要物化视图——把结果缓存下来，查询速度提升百倍。"\n\n创建物化视图 district_building_stats，统计每个区的建筑数量和平均楼层数：\n- district_id\n- building_count（COUNT(*)）\n- avg_floors（AVG(floors) 保留2位小数，用 ROUND）',
          answerSql: "CREATE MATERIALIZED VIEW district_building_stats AS\nSELECT district_id, COUNT(*) AS building_count, ROUND(AVG(floors), 2) AS avg_floors\nFROM buildings\nGROUP BY district_id;",
          checkSql: "SELECT * FROM district_building_stats ORDER BY district_id;",
          hints: [
            "CREATE MATERIALIZED VIEW 视图名 AS SELECT ...;",
            "物化视图会把查询结果物理存储，需要 REFRESH MATERIALIZED VIEW 来更新",
            "CREATE MATERIALIZED VIEW district_building_stats AS\nSELECT district_id, COUNT(*) AS building_count, ROUND(AVG(floors), 2) AS avg_floors\nFROM buildings\nGROUP BY district_id;"
          ],
          successStory: 'ZERO: "物化视图已固化。统计结果被物理存储，查询时不再重新计算。代价是数据不会自动更新——但在这个混乱的战场上，速度比实时性更重要。"'
        }
      ]
    },
    {
      id: 'ch4-5',
      title: '分区存储',
      description: 'ZERO: "传感器数据每秒产生数千条记录，单张表撑不住。分区表是解法——把数据按规则切割存储，查询时只扫描相关分区，性能提升数量级。"',
      initSql: FULL_WORLD_WITH_BUILDINGS_SQL,
      defaultSql: "CREATE TABLE sensor_logs (\n  id BIGSERIAL,\n  building_id INTEGER,\n  reading NUMERIC(8,2),\n  recorded_at TIMESTAMP NOT NULL\n) PARTITION BY RANGE (recorded_at);",
      tasks: [
        {
          prompt: '📋 数据参考：新建分区表 sensor_logs (id, building_id, reading, recorded_at)\n\nZERO: "先建父表，声明分区策略。"\n\n创建分区父表 sensor_logs，按 recorded_at 时间范围分区（PARTITION BY RANGE）：\n- id：BIGSERIAL\n- building_id：INTEGER\n- reading：NUMERIC(8,2)\n- recorded_at：TIMESTAMP NOT NULL',
          answerSql: "CREATE TABLE sensor_logs (\n  id BIGSERIAL,\n  building_id INTEGER,\n  reading NUMERIC(8,2),\n  recorded_at TIMESTAMP NOT NULL\n) PARTITION BY RANGE (recorded_at);",
          checkSql: "SELECT relname, relkind FROM pg_class WHERE relname = 'sensor_logs';",
          hints: [
            "分区表语法：CREATE TABLE 表名 (...) PARTITION BY RANGE (分区列);",
            "父表本身不存储数据，只定义结构和分区策略",
            "CREATE TABLE sensor_logs (\n  id BIGSERIAL,\n  building_id INTEGER,\n  reading NUMERIC(8,2),\n  recorded_at TIMESTAMP NOT NULL\n) PARTITION BY RANGE (recorded_at);"
          ],
          successStory: 'ZERO: "父表骨架已建立。注意——父表本身不存储任何数据，它只是一个路由器，把数据分发到各个子分区。"'
        },
        {
          prompt: '📋 数据参考：分区表 sensor_logs (id, building_id, reading, recorded_at)\n\nZERO: "父表有了，现在创建具体的分区子表。"\n\n为 sensor_logs 创建两个时间分区：\n1. sensor_logs_2154q1：存储 2154-01-01 到 2154-04-01 的数据\n2. sensor_logs_2154q2：存储 2154-04-01 到 2154-07-01 的数据\n\n语法：CREATE TABLE 子表名 PARTITION OF 父表名 FOR VALUES FROM (\'起始\') TO (\'结束\');',
          answerSql: "CREATE TABLE sensor_logs_2154q1 PARTITION OF sensor_logs FOR VALUES FROM ('2154-01-01') TO ('2154-04-01');\nCREATE TABLE sensor_logs_2154q2 PARTITION OF sensor_logs FOR VALUES FROM ('2154-04-01') TO ('2154-07-01');",
          checkSql: "SELECT relname FROM pg_class WHERE relname LIKE 'sensor_logs_2154%' ORDER BY relname;",
          hints: [
            "CREATE TABLE 子表 PARTITION OF 父表 FOR VALUES FROM ('开始时间') TO ('结束时间');",
            "RANGE 分区是左闭右开区间：[FROM, TO)",
            "CREATE TABLE sensor_logs_2154q1 PARTITION OF sensor_logs FOR VALUES FROM ('2154-01-01') TO ('2154-04-01');\nCREATE TABLE sensor_logs_2154q2 PARTITION OF sensor_logs FOR VALUES FROM ('2154-04-01') TO ('2154-07-01');"
          ],
          successStory: 'ZERO: "两个季度分区已就位。现在插入 2154 年 Q1 的数据会自动路由到 sensor_logs_2154q1，Q2 的数据进 sensor_logs_2154q2。查询时只扫描相关分区——这就是分区剪枝的威力。"'
        }
      ]
    },
    {
      id: 'ch4-6',
      title: '立法之基',
      description: 'ZERO: "战争结束了，但废墟上不能直接盖楼。上一次这座城市的数据库毫无规矩——负数预算、超标进度、重复项目满天飞。重建的第一步，是立法。用约束把规则刻进数据库的骨头里。"',
      initSql: FULL_WORLD_WITH_BUILDINGS_SQL + `
CREATE TABLE infrastructure_projects (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  district_id INTEGER REFERENCES districts(id),
  budget NUMERIC(12,2),
  progress INTEGER,
  started_at TIMESTAMP DEFAULT NOW()
);
INSERT INTO infrastructure_projects (name, district_id, budget, progress) VALUES
  ('东区电网重建', 1, 5000000, 30),
  ('西区供水修复', 2, 3200000, 55),
  ('南区通信恢复', 3, 4100000, 10),
  ('北区防御工事', 4, 8000000, 5),
  ('中心区数据中心', 5, 12000000, 0);
`,
      defaultSql: "ALTER TABLE infrastructure_projects\nADD CONSTRAINT chk_budget_positive CHECK (budget > 0);",
      tasks: [
        {
          prompt: '📋 数据参考：表 infrastructure_projects (id, name, district_id, budget, progress, started_at)\n\nZERO: "infrastructure_projects 表目前没有任何数据校验——预算可以是负数，进度可以超过 100%。这在重建中是致命的。"\n\n为 infrastructure_projects 表添加两个 CHECK 约束：\n1. chk_budget_positive：确保 budget > 0\n2. chk_progress_range：确保 progress 在 0 到 100 之间（含边界）\n\n使用一条 ALTER TABLE 语句，用逗号分隔两个 ADD CONSTRAINT 子句。',
          answerSql: "ALTER TABLE infrastructure_projects\nADD CONSTRAINT chk_budget_positive CHECK (budget > 0),\nADD CONSTRAINT chk_progress_range CHECK (progress BETWEEN 0 AND 100);",
          checkSql: "SELECT constraint_name, check_clause FROM information_schema.check_constraints WHERE constraint_schema = 'public' AND constraint_name IN ('chk_budget_positive', 'chk_progress_range') ORDER BY constraint_name;",
          hints: [
            "CHECK 约束用于限制列的取值范围，语法：ADD CONSTRAINT 约束名 CHECK (条件表达式)",
            "BETWEEN 0 AND 100 等价于 >= 0 AND <= 100，可以在一条 ALTER TABLE 中用逗号连接多个 ADD CONSTRAINT",
            "ALTER TABLE infrastructure_projects\nADD CONSTRAINT chk_budget_positive CHECK (budget > 0),\nADD CONSTRAINT chk_progress_range CHECK (progress BETWEEN 0 AND 100);"
          ],
          successStory: 'ZERO: "规则已刻入系统内核。从现在起，任何试图插入负数预算或超标进度的操作都会被数据库直接拒绝——这就是约束的力量，比任何应用层校验都可靠。"'
        },
        {
          prompt: '📋 数据参考：表 infrastructure_projects (id, name, district_id, budget, progress, started_at)\n\nZERO: "还有一个漏洞：同一个区可以登记两个同名项目，这会导致资源分配混乱。"\n\n为 infrastructure_projects 表添加一个复合唯一约束 uq_district_project，确保同一个 district_id 下不能有重复的 name。',
          answerSql: "ALTER TABLE infrastructure_projects\nADD CONSTRAINT uq_district_project UNIQUE (district_id, name);",
          checkSql: "SELECT constraint_name, constraint_type FROM information_schema.table_constraints WHERE table_name = 'infrastructure_projects' AND constraint_name = 'uq_district_project';",
          hints: [
            "复合唯一约束可以确保多列组合的唯一性，单列可以重复，但组合不能重复",
            "语法：ADD CONSTRAINT 约束名 UNIQUE (列1, 列2)",
            "ALTER TABLE infrastructure_projects\nADD CONSTRAINT uq_district_project UNIQUE (district_id, name);"
          ],
          successStory: 'ZERO: "复合唯一约束生效。注意——district_id 和 name 单独都可以重复，但它们的组合必须唯一。这比单列 UNIQUE 更灵活，也更贴合真实业务场景。"'
        }
      ]
    },
    {
      id: 'ch4-7',
      title: '连锁反应',
      description: 'ZERO: "城市的数据表之间存在复杂的依赖关系。如果一个区被撤销，那个区下面的所有设施档案怎么办？上次我们暴力 DROP 了整张表——这次要优雅地处理级联删除。"',
      initSql: FULL_WORLD_WITH_BUILDINGS_SQL + `
CREATE TABLE city_facilities (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  district_id INTEGER,
  facility_type VARCHAR(30),
  CONSTRAINT fk_facilities_district FOREIGN KEY (district_id) REFERENCES districts(id)
);
INSERT INTO city_facilities (name, district_id, facility_type) VALUES
  ('东区充电站', 1, '能源'),
  ('东区净水厂', 1, '水务'),
  ('西区回收中心', 2, '环保'),
  ('南区急救站', 3, '医疗'),
  ('北区哨塔', 4, '安防');

CREATE TABLE facility_logs (
  id SERIAL PRIMARY KEY,
  facility_id INTEGER,
  log_entry TEXT NOT NULL,
  logged_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_logs_facility FOREIGN KEY (facility_id) REFERENCES city_facilities(id)
);
INSERT INTO facility_logs (facility_id, log_entry) VALUES
  (1, '充电站启动测试完成'),
  (1, '首批用户接入'),
  (2, '净水系统校准'),
  (3, '回收流水线调试'),
  (4, '急救设备到位');
`,
      defaultSql: "ALTER TABLE city_facilities DROP CONSTRAINT fk_facilities_district;\nALTER TABLE city_facilities ADD CONSTRAINT fk_facilities_district\n  FOREIGN KEY (district_id) REFERENCES districts(id) ON DELETE CASCADE;",
      tasks: [
        {
          prompt: '📋 数据参考：表 districts (id, district_name) / 表 city_facilities (id, name, district_id, facility_type)\n\nZERO: "试试删除 districts 中 id=1 的东区——你会发现操作被外键阻止了。city_facilities 表中有东区的设施记录，普通外键不允许删除被引用的行。"\n\n先删除现有的外键约束 fk_facilities_district，然后重新添加它，这次带上 ON DELETE CASCADE——当父表行被删除时，子表中引用它的行自动跟着删除。',
          answerSql: "ALTER TABLE city_facilities DROP CONSTRAINT fk_facilities_district;\nALTER TABLE city_facilities ADD CONSTRAINT fk_facilities_district\n  FOREIGN KEY (district_id) REFERENCES districts(id) ON DELETE CASCADE;",
          checkSql: "SELECT c.confdeltype AS delete_action FROM pg_constraint c WHERE c.conname = 'fk_facilities_district';",
          hints: [
            "ON DELETE CASCADE 表示：当父表的行被删除时，子表中所有引用该行的记录自动删除",
            "需要先 DROP CONSTRAINT 删除旧约束，再 ADD CONSTRAINT 添加新约束，因为不能直接修改已有外键的级联规则",
            "ALTER TABLE city_facilities DROP CONSTRAINT fk_facilities_district;\nALTER TABLE city_facilities ADD CONSTRAINT fk_facilities_district\n  FOREIGN KEY (district_id) REFERENCES districts(id) ON DELETE CASCADE;"
          ],
          successStory: 'ZERO: "级联删除已激活。现在如果一个区被撤销，它下面的所有设施记录会自动清除——不会留下孤儿数据，也不会因为外键冲突而报错。这就是引用完整性的优雅之处。"'
        },
        {
          prompt: '📋 数据参考：表 city_facilities (id, name, district_id, facility_type) / 表 facility_logs (id, facility_id, log_entry, logged_at)\n\nZERO: "facility_logs 记录了设施的维护日志。如果设施被拆除，日志不应该跟着消失——它们是历史档案。但引用字段需要清空。"\n\n删除 facility_logs 上的外键约束 fk_logs_facility，重新添加它，使用 ON DELETE SET NULL——当设施被删除时，日志的 facility_id 自动置为 NULL，但日志本身保留。',
          answerSql: "ALTER TABLE facility_logs DROP CONSTRAINT fk_logs_facility;\nALTER TABLE facility_logs ADD CONSTRAINT fk_logs_facility\n  FOREIGN KEY (facility_id) REFERENCES city_facilities(id) ON DELETE SET NULL;",
          checkSql: "SELECT c.confdeltype AS delete_action FROM pg_constraint c WHERE c.conname = 'fk_logs_facility';",
          hints: [
            "ON DELETE SET NULL 表示：当父表行被删除时，子表中引用它的外键列自动设为 NULL（而不是删除整行）",
            "使用 SET NULL 的前提是外键列允许 NULL（即没有 NOT NULL 约束）",
            "ALTER TABLE facility_logs DROP CONSTRAINT fk_logs_facility;\nALTER TABLE facility_logs ADD CONSTRAINT fk_logs_facility\n  FOREIGN KEY (facility_id) REFERENCES city_facilities(id) ON DELETE SET NULL;"
          ],
          successStory: `ZERO: "SET NULL 策略生效。CASCADE 和 SET NULL 是两种截然不同的哲学——CASCADE 说'主人死了仆人陪葬'，SET NULL 说'主人走了仆人留下，只是忘了主人是谁'。根据业务场景选择正确的策略，这是架构师的核心能力。"`
        }
      ]
    },
    {
      id: 'ch4-8',
      title: '自动编号',
      description: 'ZERO: "城市重建需要大量新档案，每条记录都需要唯一编号。SERIAL 虽然方便，但编号从 1 开始、步长固定——我们需要自定义序列来控制编号规则。还有些字段完全可以让数据库自动计算，省去手动填写的麻烦。"',
      initSql: FULL_WORLD_WITH_BUILDINGS_SQL + `
CREATE TABLE reconstruction_tasks (
  id INTEGER PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  district_id INTEGER REFERENCES districts(id),
  unit_cost NUMERIC(10,2) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  assigned_to VARCHAR(50)
);
INSERT INTO reconstruction_tasks (id, title, district_id, unit_cost, quantity) VALUES
  (100, '东区电缆铺设', 1, 2500.00, 40),
  (101, '西区管道修复', 2, 1800.00, 25),
  (102, '南区信号塔安装', 3, 15000.00, 8);
`,
      defaultSql: "CREATE SEQUENCE task_id_seq START WITH 1000 INCREMENT BY 1;",
      tasks: [
        {
          prompt: '📋 数据参考：表 reconstruction_tasks (id, title, district_id, unit_cost, quantity, assigned_to)\n\nZERO: "reconstruction_tasks 表的 id 目前需要手动指定，容易冲突。创建一个自定义序列来自动分配编号。"\n\n1. 创建序列 task_id_seq，起始值 1000，步长 1\n2. 将 reconstruction_tasks 表的 id 列默认值设为 nextval(\'task_id_seq\')\n\n这样新插入的记录会自动从 1000 开始编号。',
          answerSql: "CREATE SEQUENCE task_id_seq START WITH 1000 INCREMENT BY 1;\nALTER TABLE reconstruction_tasks ALTER COLUMN id SET DEFAULT nextval('task_id_seq');",
          checkSql: "SELECT sequencename, start_value, increment_by FROM pg_sequences WHERE sequencename = 'task_id_seq';",
          hints: [
            "CREATE SEQUENCE 序列名 START WITH 起始值 INCREMENT BY 步长; 创建自定义序列",
            "nextval('序列名') 每次调用返回序列的下一个值，可以用 ALTER TABLE ... ALTER COLUMN ... SET DEFAULT 绑定到列",
            "CREATE SEQUENCE task_id_seq START WITH 1000 INCREMENT BY 1;\nALTER TABLE reconstruction_tasks ALTER COLUMN id SET DEFAULT nextval('task_id_seq');"
          ],
          successStory: 'ZERO: "序列已绑定。SERIAL 本质上就是 CREATE SEQUENCE + SET DEFAULT nextval() 的语法糖——但自定义序列让你能控制起始值、步长，甚至可以在多张表之间共享同一个序列。"'
        },
        {
          prompt: '📋 数据参考：表 reconstruction_tasks (id, title, district_id, unit_cost, quantity, assigned_to)\n\nZERO: "每个重建任务都有 unit_cost（单价）和 quantity（数量），总成本每次都要手算？让数据库自动搞定。"\n\n为 reconstruction_tasks 表添加一个生成列 total_cost，类型为 NUMERIC，值为 unit_cost * quantity，使用 GENERATED ALWAYS AS ... STORED 语法。',
          answerSql: "ALTER TABLE reconstruction_tasks\nADD COLUMN total_cost NUMERIC GENERATED ALWAYS AS (unit_cost * quantity) STORED;",
          checkSql: "SELECT column_name, is_generated, generation_expression FROM information_schema.columns WHERE table_name = 'reconstruction_tasks' AND column_name = 'total_cost';",
          hints: [
            "生成列（Generated Column）的值由表达式自动计算，不能手动插入或更新",
            "STORED 表示值物理存储在磁盘上（每次 INSERT/UPDATE 时计算）。PostgreSQL 目前只支持 STORED",
            "ALTER TABLE reconstruction_tasks\nADD COLUMN total_cost NUMERIC GENERATED ALWAYS AS (unit_cost * quantity) STORED;"
          ],
          successStory: 'ZERO: "生成列已就位。现在查询 reconstruction_tasks，你会看到 total_cost 自动填充了正确的值。这个字段永远不会和 unit_cost * quantity 不一致——因为它根本不允许手动写入。数据一致性，从架构层面保证。"'
        }
      ]
    },
    {
      id: 'ch4-9',
      title: '领域划分',
      description: `ZERO: "城市的所有数据都堆在 public 这一个命名空间里——就像把市政厅、医院、军营全塞进同一栋楼。是时候用 Schema 把数据按职能分区管理了。这是数据库架构设计的最后一课，也是从'写 SQL'到'设计系统'的跨越。"`,
      initSql: FULL_WORLD_WITH_BUILDINGS_SQL,
      defaultSql: "CREATE SCHEMA planning;\nCREATE TABLE planning.blueprints (\n  id SERIAL PRIMARY KEY,\n  name TEXT NOT NULL,\n  district_id INTEGER,\n  created_at TIMESTAMP DEFAULT NOW()\n);",
      tasks: [
        {
          prompt: '📋 数据参考：表 districts (id, district_name)\n\nZERO: "第一步：为城市规划部门创建独立的命名空间。"\n\n1. 创建 Schema planning\n2. 在 planning 下创建表 blueprints，包含：\n   - id: SERIAL PRIMARY KEY\n   - name: TEXT NOT NULL\n   - district_id: INTEGER\n   - created_at: TIMESTAMP DEFAULT NOW()',
          answerSql: "CREATE SCHEMA planning;\nCREATE TABLE planning.blueprints (\n  id SERIAL PRIMARY KEY,\n  name TEXT NOT NULL,\n  district_id INTEGER,\n  created_at TIMESTAMP DEFAULT NOW()\n);",
          checkSql: "SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema = 'planning' AND table_name = 'blueprints';",
          hints: [
            "CREATE SCHEMA 名称; 创建一个新的命名空间，表可以用 schema名.表名 的方式访问",
            "在指定 Schema 下建表：CREATE TABLE schema名.表名 (...);",
            "CREATE SCHEMA planning;\nCREATE TABLE planning.blueprints (\n  id SERIAL PRIMARY KEY,\n  name TEXT NOT NULL,\n  district_id INTEGER,\n  created_at TIMESTAMP DEFAULT NOW()\n);"
          ],
          successStory: 'ZERO: "planning Schema 已上线。现在 blueprints 表住在 planning 命名空间里，和 public 下的表完全隔离。访问它必须用 planning.blueprints——就像门牌号一样精确。"'
        },
        {
          prompt: '📋 数据参考：表 districts (id, district_name)\n\nZERO: "安全部门也需要自己的数据空间。创建它，建表，写入第一条日志。"\n\n1. 创建 Schema security\n2. 在 security 下创建表 access_logs：\n   - id: SERIAL PRIMARY KEY\n   - citizen_id: INTEGER\n   - action: TEXT NOT NULL\n   - logged_at: TIMESTAMP DEFAULT NOW()\n3. 插入一条记录：citizen_id = 1, action = \'schema_created\'',
          answerSql: "CREATE SCHEMA security;\nCREATE TABLE security.access_logs (\n  id SERIAL PRIMARY KEY,\n  citizen_id INTEGER,\n  action TEXT NOT NULL,\n  logged_at TIMESTAMP DEFAULT NOW()\n);\nINSERT INTO security.access_logs (citizen_id, action) VALUES (1, 'schema_created');",
          checkSql: "SELECT count(*) AS log_count FROM security.access_logs WHERE action = 'schema_created';",
          hints: [
            "可以在一次提交中连续执行 CREATE SCHEMA、CREATE TABLE、INSERT——它们会按顺序执行",
            "INSERT 时也要用 schema 限定名：INSERT INTO security.access_logs ...",
            "CREATE SCHEMA security;\nCREATE TABLE security.access_logs (\n  id SERIAL PRIMARY KEY,\n  citizen_id INTEGER,\n  action TEXT NOT NULL,\n  logged_at TIMESTAMP DEFAULT NOW()\n);\nINSERT INTO security.access_logs (citizen_id, action) VALUES (1, 'schema_created');"
          ],
          successStory: 'ZERO: "两个独立 Schema 已就位——planning 管规划，security 管安全。这座城市的数据库终于有了清晰的架构。从约束到级联，从序列到命名空间……你已经不只是在写 SQL 了，你在设计系统。准备好了吗？下一章，我们要深入数据库引擎的内核。"'
        }
      ]
    }
  ]
}
