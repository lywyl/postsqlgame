export const DISTRICTS_SQL = `
CREATE TABLE districts (
  id SERIAL PRIMARY KEY,
  district_name TEXT NOT NULL,
  population INTEGER,
  area_km2 NUMERIC(6,2)
);
INSERT INTO districts (id, district_name, population, area_km2) VALUES
  (1, '东区', 12500, 15.30),
  (2, '西区', 8800, 12.10),
  (3, '南区', 10200, 18.50),
  (4, '北区', 6500, 9.80),
  (5, '中心区', 15800, 7.20),
  (6, '工业区', 4300, 22.60),
  (7, '新城区', 7100, 14.00),
  (8, '旧城区', 3100, 4.50);
`
