package com.inet.service;

import com.inet.entity.Device;
import com.inet.entity.DeviceHistory;
import com.inet.entity.User;
import com.inet.repository.DeviceHistoryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class DeviceHistoryService {
    
    private final DeviceHistoryRepository deviceHistoryRepository;
    
    /**
     * 장비 수정내역 저장
     */
    @Transactional
    public void saveDeviceHistory(Device device, String fieldName, String beforeValue, String afterValue, User modifiedBy) {
        if (beforeValue == null) beforeValue = "";
        if (afterValue == null) afterValue = "";
        
        // 값이 실제로 변경된 경우에만 히스토리 저장
        if (!beforeValue.equals(afterValue)) {
            DeviceHistory history = new DeviceHistory(device, fieldName, beforeValue, afterValue, modifiedBy);
            deviceHistoryRepository.save(history);
            log.info("장비 수정내역 저장: 장비ID={}, 필드={}, 이전값={}, 변경값={}, 수정자={}", 
                    device.getDeviceId(), fieldName, beforeValue, afterValue, modifiedBy.getName());
        }
    }
    
    /**
     * 장비별 수정내역 조회
     */
    public List<DeviceHistory> getDeviceHistory(Device device) {
        return deviceHistoryRepository.findByDeviceOrderByModifiedAtDesc(device);
    }
    
    /**
     * 학교별 수정내역 조회 (페이징)
     */
    public Page<DeviceHistory> getDeviceHistoryBySchool(Long schoolId, int page, int size) {
        Pageable pageable = PageRequest.of(page - 1, size);
        return deviceHistoryRepository.findBySchoolId(schoolId, pageable);
    }
    
    /**
     * 검색 조건으로 수정내역 조회
     */
    public Page<DeviceHistory> getDeviceHistoryBySchoolAndSearch(Long schoolId, String searchType, 
                                                               String searchKeyword, int page, int size) {
        Pageable pageable = PageRequest.of(page - 1, size);
        return deviceHistoryRepository.findBySchoolIdAndSearchConditions(schoolId, searchType, searchKeyword, pageable);
    }
    
    /**
     * 학교별 전체 수정내역 조회 (엑셀 다운로드용)
     */
    public List<DeviceHistory> getAllDeviceHistoryBySchool(Long schoolId) {
        return deviceHistoryRepository.findBySchoolId(schoolId);
    }
    
    /**
     * 필드명을 한글로 변환
     */
    public String getFieldNameInKorean(String fieldName) {
        switch (fieldName) {
            case "type": return "장비구분";
            case "manufacturer": return "제조사";
            case "modelName": return "모델명";
            case "purchaseDate": return "구매일자";
            case "ipAddress": return "IP주소";
            case "purpose": return "용도";
            case "setType": return "설치형태";
            case "unused": return "미사용여부";
            case "note": return "비고";
            case "school": return "학교";
            case "classroom": return "교실";
            case "operator": return "담당자";
            case "manage": return "관리번호";
            case "uid": return "고유번호";
            default: return fieldName;
        }
    }
    
    /**
     * 모든 장비 유형 조회
     */
    public List<String> getAllDeviceTypes() {
        return deviceHistoryRepository.findAllDeviceTypes();
    }
}
