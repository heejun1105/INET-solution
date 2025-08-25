package com.inet.service;

import com.inet.entity.Device;
import com.inet.entity.DeviceHistory;
import com.inet.entity.User;
import com.inet.repository.DeviceHistoryRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class DeviceHistoryService {
    
    private static final Logger log = LoggerFactory.getLogger(DeviceHistoryService.class);
    
    private final DeviceHistoryRepository deviceHistoryRepository;
    
    public DeviceHistoryService(DeviceHistoryRepository deviceHistoryRepository) {
        this.deviceHistoryRepository = deviceHistoryRepository;
    }
    
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
        Page<DeviceHistory> historyPage = deviceHistoryRepository.findBySchoolId(schoolId, pageable);
        
        // 연관 엔티티를 별도로 로딩
        historyPage.getContent().forEach(history -> {
            if (history.getDevice() != null) {
                // Device의 연관 엔티티들을 초기화
                history.getDevice().getSchool();
                if (history.getDevice().getClassroom() != null) {
                    history.getDevice().getClassroom().getRoomName();
                }
                if (history.getDevice().getOperator() != null) {
                    history.getDevice().getOperator().getName();
                }
                if (history.getDevice().getManage() != null) {
                    history.getDevice().getManage().getManageCate();
                    history.getDevice().getManage().getYear();
                    history.getDevice().getManage().getManageNum();
                }
                if (history.getDevice().getUid() != null) {
                    // UID의 모든 속성을 강제로 접근하여 초기화
                    String cate = history.getDevice().getUid().getCate();
                    String mfgYear = history.getDevice().getUid().getMfgYear();
                    Long idNumber = history.getDevice().getUid().getIdNumber();
                    // displayUid가 없으면 자동 생성
                    if (history.getDevice().getUid().getDisplayUid() == null) {
                        history.getDevice().getUid().generateDisplayUid();
                    }
                    // 로깅으로 확인
                    log.info("UID 초기화: cate={}, mfgYear={}, idNumber={}, displayUid={}", 
                            cate, mfgYear, idNumber, history.getDevice().getUid().getDisplayUid());
                }
            }
            if (history.getModifiedBy() != null) {
                history.getModifiedBy().getName();
            }
        });
        
        return historyPage;
    }
    
    /**
     * 검색 조건으로 수정내역 조회
     */
    public Page<DeviceHistory> getDeviceHistoryBySchoolAndSearch(Long schoolId, String searchType, 
                                                               String searchKeyword, int page, int size) {
        Pageable pageable = PageRequest.of(page - 1, size);
        Page<DeviceHistory> historyPage = deviceHistoryRepository.findBySchoolIdAndSearchConditions(schoolId, searchType, searchKeyword, pageable);
        
        // 연관 엔티티를 별도로 로딩
        historyPage.getContent().forEach(history -> {
            if (history.getDevice() != null) {
                // Device의 연관 엔티티들을 초기화
                history.getDevice().getSchool();
                if (history.getDevice().getClassroom() != null) {
                    history.getDevice().getClassroom().getRoomName();
                }
                if (history.getDevice().getOperator() != null) {
                    history.getDevice().getOperator().getName();
                }
                if (history.getDevice().getManage() != null) {
                    history.getDevice().getManage().getManageCate();
                    history.getDevice().getManage().getYear();
                    history.getDevice().getManage().getManageNum();
                }
                if (history.getDevice().getUid() != null) {
                    history.getDevice().getUid().getCate();
                    history.getDevice().getUid().getMfgYear();
                    history.getDevice().getUid().getIdNumber();
                    // displayUid가 없으면 자동 생성
                    if (history.getDevice().getUid().getDisplayUid() == null) {
                        history.getDevice().getUid().generateDisplayUid();
                    }
                }
            }
            if (history.getModifiedBy() != null) {
                history.getModifiedBy().getName();
            }
        });
        
        return historyPage;
    }
    
    /**
     * 학교별 전체 수정내역 조회 (엑셀 다운로드용)
     */
    public List<DeviceHistory> getAllDeviceHistoryBySchool(Long schoolId) {
        List<DeviceHistory> histories = deviceHistoryRepository.findBySchoolId(schoolId);
        
        // 연관 엔티티를 별도로 로딩
        histories.forEach(history -> {
            if (history.getDevice() != null) {
                // Device의 연관 엔티티들을 초기화
                history.getDevice().getSchool();
                if (history.getDevice().getClassroom() != null) {
                    history.getDevice().getClassroom().getRoomName();
                }
                if (history.getDevice().getOperator() != null) {
                    history.getDevice().getOperator().getName();
                }
                if (history.getDevice().getManage() != null) {
                    history.getDevice().getManage().getManageCate();
                    history.getDevice().getManage().getYear();
                    history.getDevice().getManage().getManageNum();
                }
                if (history.getDevice().getUid() != null) {
                    history.getDevice().getUid().getCate();
                    history.getDevice().getUid().getMfgYear();
                    history.getDevice().getUid().getIdNumber();
                }
            }
            if (history.getModifiedBy() != null) {
                history.getModifiedBy().getName();
            }
        });
        
        return histories;
    }
    
    /**
     * 필드명을 한글로 변환
     */
    public String getFieldNameInKorean(String fieldName) {
        switch (fieldName) {
            case "type": return "장비구분";
            case "manufacturer": return "제조사";
            case "modelName": return "모델명";
            case "purchaseDate": return "도입일자";
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
