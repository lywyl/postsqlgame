export const CRIME_RECORDS_SQL = `
CREATE TABLE crime_records (
  id SERIAL PRIMARY KEY,
  citizen_id INTEGER REFERENCES citizens(id),
  district_id INTEGER REFERENCES districts(id),
  crime_type TEXT NOT NULL,
  severity INTEGER CHECK (severity BETWEEN 1 AND 10),
  description TEXT,
  status TEXT DEFAULT 'open',
  reported_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO crime_records (citizen_id, district_id, crime_type, severity, description, status, reported_at) VALUES
  (5, 4, 'unauthorized_access', 7, '北区军事基地未授权访问记录', 'closed', '2025-01-03 02:15:00'),
  (12, 3, 'data_tampering', 9, '南区金融数据篡改嫌疑', 'investigating', '2025-01-08 14:30:00'),
  (18, 6, 'illegal_transaction', 8, '旧城区地下市场非法资金流转', 'open', '2025-01-12 22:45:00'),
  (22, 1, 'identity_fraud', 6, '东区市民身份冒用', 'closed', '2025-01-15 09:20:00'),
  (29, 5, 'corruption', 10, '疑似区级官员贪污线索', 'investigating', '2025-01-18 16:00:00'),
  (35, 2, 'sabotage', 7, '西区能源站设备异常报告', 'open', '2025-01-22 03:10:00'),
  (8, 3, 'data_tampering', 8, '南区交易所数据泄露嫌疑', 'closed', '2025-02-01 11:45:00'),
  (41, 7, 'smuggling', 6, '港口区货运异常申报', 'investigating', '2025-02-05 20:30:00'),
  (15, 5, 'corruption', 9, '中区议会预算异常关联', 'open', '2025-02-10 13:00:00'),
  (27, 6, 'unauthorized_access', 5, '旧城区废弃网络入侵痕迹', 'closed', '2025-02-14 07:55:00'),
  (33, 8, 'espionage', 10, '科技区量子实验室数据外泄嫌疑', 'investigating', '2025-02-18 18:20:00'),
  (19, 4, 'illegal_surveillance', 7, '北区安保系统未授权监控', 'open', '2025-02-22 04:40:00'),
  (44, 1, 'identity_fraud', 6, '中央数据塔虚假身份注册', 'closed', '2025-03-01 10:15:00'),
  (7, 2, 'sabotage', 8, '西区技术研究院数据损毁', 'investigating', '2025-03-05 15:30:00'),
  (38, 3, 'illegal_transaction', 7, '南区豪华公寓资金洗钱嫌疑', 'open', '2025-03-10 21:00:00'),
  (25, 5, 'corruption', 9, '中区市长官邸不明资金来源', 'investigating', '2025-03-14 12:00:00'),
  (50, 7, 'smuggling', 6, '港口区海关虚假报关', 'closed', '2025-03-18 08:30:00'),
  (10, 1, 'data_tampering', 5, '东区行政系统数据修改痕迹', 'closed', '2025-03-22 17:45:00'),
  (46, 8, 'espionage', 8, '科技区AI研究中心定向数据窃取', 'open', '2025-03-28 01:20:00'),
  (31, 6, 'unauthorized_access', 4, '旧城区地下网络通信异常', 'closed', '2025-04-01 22:10:00');
`