-- 기존 USER 역할을 EMPLOYEE로 변경
UPDATE users SET role = 'EMPLOYEE' WHERE role = 'USER';

-- MANAGER 역할을 EXTERNAL로 변경 (만약 있다면)
UPDATE users SET role = 'EXTERNAL' WHERE role = 'MANAGER'; 