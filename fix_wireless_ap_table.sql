-- 무선AP 테이블 수정 SQL
-- 1. note 컬럼을 classroom_type으로 변경
ALTER TABLE wireless_ap CHANGE COLUMN note classroom_type VARCHAR(255);

-- 2. speed 컬럼 추가
ALTER TABLE wireless_ap ADD COLUMN speed VARCHAR(255) AFTER classroom_type;

-- 3. 컬럼 순서 확인 (현재 순서)
-- id, location, school_id, new_label_number, device_number, ap_year, manufacturer, model, mac_address, prev_location, prev_label_number, classroom_type, speed

-- 4. 인덱스 추가 (성능 향상)
CREATE INDEX idx_wireless_ap_school ON wireless_ap(school_id);
CREATE INDEX idx_wireless_ap_location ON wireless_ap(location);
CREATE INDEX idx_wireless_ap_classroom_type ON wireless_ap(classroom_type);
