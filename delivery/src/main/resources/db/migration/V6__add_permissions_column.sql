-- 사용자 테이블에 기능별 접근권한 컬럼 추가
ALTER TABLE users ADD COLUMN permissions VARCHAR(1000) NULL;

-- 기본 권한 설정 (모든 기능 접근 가능)
UPDATE users SET permissions = '["device", "school", "classroom", "wireless-ap", "ip", "floorplan", "data"]' WHERE role = 'ADMIN';
UPDATE users SET permissions = '["device", "school", "classroom", "wireless-ap", "ip", "floorplan", "data"]' WHERE role = 'MANAGER';
UPDATE users SET permissions = '["device", "ip", "wireless-ap"]' WHERE role = 'USER';

