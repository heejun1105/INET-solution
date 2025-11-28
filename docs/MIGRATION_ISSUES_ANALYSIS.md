# 마이그레이션 파일 문제 분석 및 해결 방안

## 🚨 발견된 문제점

### 1. 중복 버전 번호 문제 (심각)

Flyway는 같은 버전 번호가 있으면 **실행 순서를 보장하지 못합니다!**

#### V3 중복 (2개)
- `V3__create_users_table.sql` ✅ 필요 (users 테이블 생성)
- `V3__create_device_inspection_history_table.sql` ✅ 필요 (device_inspection_history 테이블 생성)

**문제**: 두 파일이 동시에 실행될 수 있고, 순서가 보장되지 않음

#### V8 중복 (2개)
- `V8__create_school_permissions_table.sql` ✅ 필요 (school_permissions 테이블 생성)
- `V8__extend_feature_column_size.sql` ✅ 필요 (permissions.feature 컬럼 확장)

**문제**: 순서가 중요할 수 있음 (school_permissions 생성 후 feature 확장?)

#### V9 중복 (3개)
- `V9__add_device_inspection_to_feature_enum.sql` ✅ 필요 (ENUM에 DEVICE_INSPECTION 추가)
- `V9__create_wireless_ap_history_table.sql` ✅ 필요 (wireless_ap_history 테이블 생성)
- `V9__remove_permission_type.sql` ✅ 필요 (permissions.permission_type 컬럼 제거)

**문제**: 3개 파일이 동시에 실행될 수 있음

#### V10 중복 (2개)
- `V10__create_device_inspection_status_table.sql` ⚠️ **V11에서 DROP되므로 불필요!**
- `V10__rebuild_floorplan_system.sql` ✅ 필요 (network_equipment 테이블 생성, 사용 중)

**문제**: V10__create_device_inspection_status_table.sql은 V11에서 삭제되므로 불필요

#### V11 중복 (2개)
- `V11__create_simple_device_inspection_status.sql` ✅ 필요 (현재 사용 중인 버전)
- `V11__fix_user_roles.sql` ✅ 필요 (users.role 업데이트)

**문제**: 순서가 중요할 수 있음

---

### 2. 충돌 문제 (심각)

#### device_inspection_status 테이블 충돌

**V10__create_device_inspection_status_table.sql:**
```sql
CREATE TABLE device_inspection_status (
    ...
    inspection_status ENUM('unchecked', 'confirmed', 'modified') NOT NULL DEFAULT 'unchecked',
    inspection_date DATETIME NOT NULL,  -- 날짜 포함
    ...
);
```

**V11__create_simple_device_inspection_status.sql:**
```sql
DROP TABLE IF EXISTS device_inspection_status;  -- V10에서 만든 테이블 삭제!
CREATE TABLE device_inspection_status (
    ...
    inspection_status VARCHAR(20) NOT NULL,  -- ENUM이 아닌 VARCHAR
    -- inspection_date 없음
    ...
);
```

**현재 코드 상태:**
- `DeviceInspectionStatus.java` 엔티티는 VARCHAR를 사용 (V11 버전과 일치)
- `inspection_date` 필드 없음 (V11 버전과 일치)

**결론**: V10__create_device_inspection_status_table.sql은 **불필요하며 삭제해야 함**

---

### 3. 버전 번호 없는 파일

#### floorplan_enhancement.sql
- Flyway가 인식하지 못함 (V{번호}__ 형식이 아님)
- `V10__rebuild_floorplan_system.sql`과 비슷한 작업을 수행
- **삭제 또는 버전 번호 추가 필요**

---

### 4. 순서 문제

- V12, V13, V14가 없고 V15가 있음
- 이건 문제 없음 (Flyway는 버전 번호 순서대로 실행)

---

## ✅ 해결 방안

### 즉시 조치 필요

1. **V10__create_device_inspection_status_table.sql 삭제**
   - V11에서 이미 DROP하고 재생성하므로 불필요
   - 삭제해도 현재 시스템에 영향 없음

2. **floorplan_enhancement.sql 처리**
   - 삭제 (V10__rebuild_floorplan_system.sql이 이미 처리)
   - 또는 V19__floorplan_enhancement.sql로 이름 변경 (내용 확인 후)

3. **중복 버전 번호 재정렬**
   - V3, V8, V9, V11의 중복 파일들을 순서대로 재번호 매기기
   - 예: V3, V3_1 → V3, V4로 변경

---

## 📋 권장 조치 사항

### 옵션 1: 중복 버전 재정렬 (권장)

```
현재 → 변경 후
V3__create_users_table.sql → V3__create_users_table.sql (유지)
V3__create_device_inspection_history_table.sql → V4__create_device_inspection_history_table.sql
V4__add_name_column_to_users.sql → V5__add_name_column_to_users.sql
V5__create_admin_account.sql → V6__create_admin_account.sql
V6__add_permissions_column.sql → V7__add_permissions_column.sql
V7__create_permissions_table.sql → V8__create_permissions_table.sql
V8__create_school_permissions_table.sql → V9__create_school_permissions_table.sql
V8__extend_feature_column_size.sql → V10__extend_feature_column_size.sql
V9__add_device_inspection_to_feature_enum.sql → V11__add_device_inspection_to_feature_enum.sql
V9__create_wireless_ap_history_table.sql → V12__create_wireless_ap_history_table.sql
V9__remove_permission_type.sql → V13__remove_permission_type.sql
V10__rebuild_floorplan_system.sql → V14__rebuild_floorplan_system.sql
V11__create_simple_device_inspection_status.sql → V15__create_simple_device_inspection_status.sql
V11__fix_user_roles.sql → V16__fix_user_roles.sql
V15__force_update_roles_final.sql → V17__force_update_roles_final.sql
V16__add_email_and_security_fields.sql → V18__add_email_and_security_fields.sql
V17__create_device_history_table.sql → V19__create_device_history_table.sql
V18__add_display_uid_to_uid_table.sql → V20__add_display_uid_to_uid_table.sql
```

**주의**: 이미 실행된 마이그레이션이 있다면 Flyway 히스토리 테이블도 업데이트 필요!

### 옵션 2: 불필요한 파일만 삭제 (간단)

1. `V10__create_device_inspection_status_table.sql` 삭제
2. `floorplan_enhancement.sql` 삭제
3. 중복 버전은 그대로 두되, 실행 순서가 보장되지 않음을 문서화

---

## 🎯 최종 권장사항

**의뢰자에게 전달하기 전에:**

1. ✅ `V10__create_device_inspection_status_table.sql` 삭제 (확실히 불필요)
2. ✅ `floorplan_enhancement.sql` 삭제 또는 V19로 변경 (내용 확인 후)
3. ⚠️ 중복 버전 재정렬 (선택사항, 하지만 권장)

**중복 버전 재정렬은 신중하게:**
- 이미 운영 환경에서 실행된 마이그레이션이 있다면
- Flyway 히스토리 테이블(`flyway_schema_history`)도 함께 업데이트해야 함
- 새로 설치하는 환경에서는 문제없음

