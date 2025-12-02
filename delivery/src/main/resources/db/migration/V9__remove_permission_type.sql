-- permissions 테이블에서 permission_type 컬럼 제거
ALTER TABLE permissions DROP COLUMN IF EXISTS permission_type;

