USE inet;

-- 기존 USER 역할을 EMPLOYEE로 변경
UPDATE users SET role = 'EMPLOYEE' WHERE role = 'USER';

-- MANAGER 역할을 EXTERNAL로 변경 (만약 있다면)
UPDATE users SET role = 'EXTERNAL' WHERE role = 'MANAGER';

-- 변경된 데이터 확인
SELECT username, role FROM users; 