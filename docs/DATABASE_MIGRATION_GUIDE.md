# 데이터베이스 마이그레이션 가이드

## 📌 현재 상황

프로젝트에는 **Flyway**를 사용한 데이터베이스 마이그레이션이 설정되어 있습니다.

### 마이그레이션 파일 위치
```
src/main/resources/db/migration/
```

### 주요 마이그레이션 파일들
- `V1__convert_mfg_year_to_varchar.sql` - 제조년도 컬럼 타입 변경
- `V2__create_floor_plan_tables.sql` - 평면도 테이블 생성
- `V3__create_users_table.sql` - 사용자 테이블 생성
- `V4__add_name_column_to_users.sql` - 사용자 이름 컬럼 추가
- `V5__create_admin_account.sql` - 관리자 계정 생성
- `V6__add_permissions_column.sql` - 권한 컬럼 추가
- `V7__create_permissions_table.sql` - 권한 테이블 생성
- `V8__create_school_permissions_table.sql` - 학교별 권한 테이블 생성
- `V9__create_wireless_ap_history_table.sql` - 무선AP 이력 테이블 생성
- `V17__create_device_history_table.sql` - 장비 이력 테이블 생성
- `V18__add_display_uid_to_uid_table.sql` - 고유번호 표시 필드 추가
- ... 기타 마이그레이션 파일들

---

## 🚀 마이그레이션 실행 방법

### 방법 1: Flyway 자동 실행 (권장)

**운영 환경에서는 Flyway가 자동으로 실행됩니다.**

`application-prod.properties.example`에 이미 설정되어 있습니다:

```properties
# Flyway (DB 마이그레이션)
spring.flyway.enabled=true
spring.flyway.baseline-on-migrate=true
spring.flyway.locations=classpath:db/migration
spring.flyway.validate-on-migrate=true
```

**Docker로 실행 시:**
- 애플리케이션이 시작될 때 자동으로 마이그레이션이 실행됩니다
- 첫 실행 시: 모든 마이그레이션 파일이 순서대로 실행됩니다
- 이후 실행 시: 새로운 마이그레이션 파일만 실행됩니다

### 방법 2: 수동 마이그레이션 (필요 시)

만약 Flyway를 사용하지 않고 수동으로 실행해야 한다면:

1. **MySQL에 접속**
```bash
mysql -u root -p inet
```

2. **마이그레이션 파일을 순서대로 실행**
```sql
-- 예시: V1부터 순서대로
source src/main/resources/db/migration/V1__convert_mfg_year_to_varchar.sql;
source src/main/resources/db/migration/V2__create_floor_plan_tables.sql;
-- ... 나머지 파일들
```

---

## ⚠️ 주의사항

### 1. 마이그레이션 순서
- Flyway는 파일명의 버전 번호(V1, V2, ...) 순서대로 실행합니다
- **절대 순서를 바꾸거나 중간에 버전을 건너뛰면 안 됩니다!**

### 2. 기존 데이터베이스가 있는 경우

**기존 DB에 데이터가 있다면:**

1. **백업 필수!**
```bash
mysqldump -u root -p inet > backup_before_migration.sql
```

2. **Flyway baseline 설정**
- `spring.flyway.baseline-on-migrate=true`가 설정되어 있으면 자동 처리됩니다
- 기존 DB를 baseline으로 인식하고, 이후 마이그레이션만 실행합니다

3. **데이터 호환성 확인**
- 일부 마이그레이션은 데이터 변환이 필요할 수 있습니다
- 마이그레이션 전에 각 SQL 파일을 검토하세요

### 3. 마이그레이션 실패 시

마이그레이션이 실패하면:

1. **Flyway 히스토리 테이블 확인**
```sql
SELECT * FROM flyway_schema_history;
```

2. **실패한 마이그레이션 확인**
- `success = 0`인 항목을 찾습니다

3. **수동으로 수정 후 재실행**
- 문제를 해결한 후
- Flyway는 실패한 마이그레이션을 다시 실행합니다

---

## 🔍 마이그레이션 상태 확인

### Flyway 히스토리 테이블 조회

```sql
-- 실행된 마이그레이션 목록 확인
SELECT * FROM flyway_schema_history ORDER BY installed_rank;

-- 최신 마이그레이션 확인
SELECT * FROM flyway_schema_history 
ORDER BY installed_rank DESC 
LIMIT 5;
```

### 애플리케이션 로그 확인

애플리케이션 시작 시 Flyway 로그를 확인:

```
Flyway Community Edition ... by Redgate
Database: jdbc:mysql://localhost:3306/inet
Successfully validated 18 migrations (execution time 00:00.123s)
Current version of schema `inet`: 18
Schema `inet` is up to date. No migration necessary.
```

---

## 📝 새로운 마이그레이션 추가 방법

새로운 마이그레이션을 추가해야 할 때:

1. **파일명 규칙 준수**
```
V{버전번호}__{설명}.sql
예: V19__add_new_column.sql
```

2. **버전 번호는 반드시 증가**
- 마지막 버전이 V18이면 다음은 V19
- 중간에 끼워넣지 말고 항상 마지막에 추가

3. **파일 위치**
```
src/main/resources/db/migration/V19__add_new_column.sql
```

4. **SQL 작성 시 주의**
- DDL(테이블 생성/수정)과 DML(데이터 삽입/수정) 모두 가능
- 트랜잭션은 각 마이그레이션 파일 단위로 자동 처리됩니다

---

## 🎯 요약

### Docker 사용 시 (권장)
✅ **자동으로 처리됩니다!**
- `docker-compose up` 실행 시
- Flyway가 자동으로 모든 마이그레이션을 실행합니다
- 별도 작업 불필요

### 수동 실행 시
1. `application-prod.properties`에서 Flyway 활성화 확인
2. 애플리케이션 시작 시 자동 실행
3. 로그에서 마이그레이션 상태 확인

---

**문제가 발생하면 로그를 확인하고, 필요시 데이터베이스를 백업한 후 마이그레이션을 실행하세요!**

