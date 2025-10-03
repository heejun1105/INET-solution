-- permissions 테이블의 feature 컬럼 크기 확장
ALTER TABLE permissions MODIFY COLUMN feature VARCHAR(100) NOT NULL;
