-- Force update all roles using a more robust approach
-- First, temporarily allow any value in the role column
ALTER TABLE users MODIFY COLUMN role VARCHAR(20) NOT NULL DEFAULT 'EMPLOYEE';

-- Update all roles to new values
UPDATE users SET role = 'EMPLOYEE' WHERE role = 'USER';
UPDATE users SET role = 'EXTERNAL' WHERE role = 'MANAGER';


-- Now change back to ENUM with new values
ALTER TABLE users MODIFY COLUMN role ENUM('ADMIN', 'EMPLOYEE', 'EXTERNAL') NOT NULL DEFAULT 'EMPLOYEE'; 