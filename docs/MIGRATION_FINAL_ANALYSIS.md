# 마이그레이션 최종 분석 및 정리

## 🔍 발견된 문제점

### 1. Feature 컬럼 타입 충돌

**V8__extend_feature_column_size.sql:**
- feature를 VARCHAR(100)로 변경

**V9__add_device_inspection_to_feature_enum.sql:**
- feature를 ENUM으로 변경하려고 시도

**현재 코드 상태:**
- Permission 엔티티는 `@Enumerated(EnumType.STRING)` 사용
- 이는 VARCHAR를 사용하는 것이 맞음
- ENUM 타입으로 변경하면 문제 발생 가능

**결론:** V9__add_device_inspection_to_feature_enum.sql은 **불필요하거나 문제가 될 수 있음**

### 2. Role 업데이트 중복

**V11__fix_user_roles.sql:**
- 단순 UPDATE만 수행
- role이 ENUM이면 실패할 수 있음

**V15__force_update_roles_final.sql:**
- VARCHAR로 변경 → UPDATE → ENUM으로 변경
- 더 robust한 방법

**결론:** V11__fix_user_roles.sql은 **불필요** (V15가 더 나은 방법)

### 3. 중복 버전 번호

- V3: 2개
- V8: 2개  
- V9: 3개
- V11: 2개

---

## ✅ 최종 정리 방안

### 삭제할 파일

1. **V9__add_device_inspection_to_feature_enum.sql** ❌
   - 이유: V8에서 이미 VARCHAR(100)로 변경했고, 현재 코드는 VARCHAR를 사용
   - ENUM으로 변경하면 @Enumerated(EnumType.STRING)와 충돌

2. **V11__fix_user_roles.sql** ❌
   - 이유: V15가 더 robust한 방법으로 같은 작업 수행
   - V15가 이미 실행되면 불필요

### 유지할 파일 (모두 필요)

- V1: mfg_year VARCHAR 변환 ✅
- V2: floor_plan 테이블 생성 ✅
- V3__create_users_table.sql: users 테이블 생성 ✅
- V3__create_device_inspection_history_table.sql: device_inspection_history 테이블 생성 ✅
- V4: users.name 컬럼 추가 ✅
- V5: admin 계정 생성 ✅
- V6: users.permissions 컬럼 추가 (V7에서 제거되지만 순서상 필요) ✅
- V7: permissions 테이블 생성 ✅
- V8__create_school_permissions_table.sql: school_permissions 테이블 생성 ✅
- V8__extend_feature_column_size.sql: feature VARCHAR(100) 확장 ✅
- V9__create_wireless_ap_history_table.sql: wireless_ap_history 테이블 생성 ✅
- V9__remove_permission_type.sql: permission_type 제거 ✅
- V10: network_equipment 테이블 생성 ✅
- V11__create_simple_device_inspection_status.sql: device_inspection_status 테이블 생성 ✅
- V15: role 업데이트 (robust 방법) ✅
- V16: email, security 필드 추가 ✅
- V17: device_history 테이블 생성 ✅
- V18: display_uid 컬럼 추가 ✅
- V19: floorplan enhancement ✅

---

## 📋 정리 후 마이그레이션 목록

```
V1__convert_mfg_year_to_varchar.sql
V2__create_floor_plan_tables.sql
V3__create_device_inspection_history_table.sql
V3__create_users_table.sql
V4__add_name_column_to_users.sql
V5__create_admin_account.sql
V6__add_permissions_column.sql
V7__create_permissions_table.sql
V8__create_school_permissions_table.sql
V8__extend_feature_column_size.sql
V9__create_wireless_ap_history_table.sql
V9__remove_permission_type.sql
V10__rebuild_floorplan_system.sql
V11__create_simple_device_inspection_status.sql
V15__force_update_roles_final.sql
V16__add_email_and_security_fields.sql
V17__create_device_history_table.sql
V18__add_display_uid_to_uid_table.sql
V19__floorplan_enhancement.sql
```

**삭제:**
- V9__add_device_inspection_to_feature_enum.sql
- V11__fix_user_roles.sql

