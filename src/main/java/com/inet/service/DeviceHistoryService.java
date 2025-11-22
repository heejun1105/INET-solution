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
import java.time.LocalDateTime;
import java.util.Optional;

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
     * 장비별 마지막 수정일자 조회
     */
    public Optional<LocalDateTime> getLastModifiedDate(Device device) {
        List<DeviceHistory> histories = deviceHistoryRepository.findByDeviceOrderByModifiedAtDesc(device);
        if (histories.isEmpty()) {
            return Optional.empty();
        }
        return Optional.of(histories.get(0).getModifiedAt());
    }
    
    /**
     * 장비의 IP 주소 필드가 수정된 마지막 날짜 조회
     */
    public Optional<LocalDateTime> getLastIpAddressModifiedDate(Device device) {
        List<DeviceHistory> histories = deviceHistoryRepository.findByDeviceOrderByModifiedAtDesc(device);
        return histories.stream()
                .filter(h -> "ipAddress".equals(h.getFieldName()))
                .findFirst()
                .map(DeviceHistory::getModifiedAt);
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
        // 검색 조건 정리
        String cleanSearchType = (searchType != null && !searchType.trim().isEmpty()) ? searchType.trim() : null;
        String cleanSearchKeyword = (searchKeyword != null && !searchKeyword.trim().isEmpty()) ? searchKeyword.trim() : null;
        
        log.info("검색 조건: schoolId={}, searchType={}, searchKeyword={}, page={}, size={}", 
                schoolId, cleanSearchType, cleanSearchKeyword, page, size);
        log.info("검색 조건 정리 후: searchType='{}', searchKeyword='{}'", cleanSearchType, cleanSearchKeyword);
        
        Pageable pageable = PageRequest.of(page - 1, size);
        Page<DeviceHistory> historyPage = deviceHistoryRepository.findBySchoolIdAndSearchConditions(schoolId, cleanSearchType, cleanSearchKeyword, pageable);
        
        log.info("검색 결과: 총 {}건, 현재 페이지 {}건", historyPage.getTotalElements(), historyPage.getContent().size());
        
        // 검색 결과가 없을 때 디버깅 정보 로깅
        if (historyPage.getTotalElements() == 0) {
            log.warn("검색 결과가 없습니다. 검색 조건을 확인해보세요.");
            log.warn("검색 키워드: '{}'", searchKeyword);
            log.warn("학교 ID: {}", schoolId);
            log.warn("검색 타입: {}", searchType);
        }
        
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
    
    /**
     * 사용자가 권한을 가진 모든 학교의 수정내역 조회 (페이징)
     */
    public Page<DeviceHistory> getAllDeviceHistoryBySchool(int page, int size, User user) {
        Pageable pageable = PageRequest.of(page - 1, size);
        Page<DeviceHistory> historyPage = deviceHistoryRepository.findAllByUserPermissions(pageable);
        
        // 연관 엔티티를 별도로 로딩
        historyPage.getContent().forEach(history -> {
            if (history.getDevice() != null) {
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
     * 사용자가 권한을 가진 모든 학교의 수정내역 검색 (페이징)
     */
    public Page<DeviceHistory> getAllDeviceHistoryBySchoolAndSearch(String searchType, String searchKeyword, int page, int size, User user) {
        // 검색 조건 정리
        String cleanSearchType = (searchType != null && !searchType.trim().isEmpty()) ? searchType.trim() : null;
        String cleanSearchKeyword = (searchKeyword != null && !searchKeyword.trim().isEmpty()) ? searchKeyword.trim() : null;
        
        log.info("전체 학교 검색 조건: searchType={}, searchKeyword={}, page={}, size={}", 
                cleanSearchType, cleanSearchKeyword, page, size);
        
        Pageable pageable = PageRequest.of(page - 1, size);
        Page<DeviceHistory> historyPage = deviceHistoryRepository.findAllByUserPermissionsAndSearch(cleanSearchType, cleanSearchKeyword, pageable);
        
        log.info("전체 학교 검색 결과: 총 {}건, 현재 페이지 {}건", historyPage.getTotalElements(), historyPage.getContent().size());
        
        // 연관 엔티티를 별도로 로딩
        historyPage.getContent().forEach(history -> {
            if (history.getDevice() != null) {
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
     * 검색 키워드를 HTML 하이라이트 태그로 감싸기
     */
    public String highlightSearchKeyword(String text, String searchKeyword) {
        if (text == null || searchKeyword == null || searchKeyword.trim().isEmpty()) {
            return text;
        }
        
        String cleanKeyword = searchKeyword.trim();
        if (cleanKeyword.isEmpty()) {
            return text;
        }
        
        // 대소문자 구분 없이 검색 키워드 강조
        String regex = "(?i)(" + java.util.regex.Pattern.quote(cleanKeyword) + ")";
        return text.replaceAll(regex, "<mark class='search-highlight'>$1</mark>");
    }
    
    /**
     * 특정 학교의 장비 수정내역 삭제
     */
    @Transactional
    public void deleteDeviceHistoryBySchool(Long schoolId) {
        deviceHistoryRepository.deleteBySchoolId(schoolId);
        log.info("학교별 장비 수정내역 삭제: schoolId={}", schoolId);
    }
    
    /**
     * 전체 장비 수정내역 삭제
     */
    @Transactional
    public void deleteAllDeviceHistory() {
        deviceHistoryRepository.deleteAll();
        log.info("전체 장비 수정내역 삭제 완료");
    }
    
    /**
     * 특정 날짜 이전의 장비 수정내역 삭제
     */
    @Transactional
    public void deleteDeviceHistoryByDate(java.time.LocalDateTime beforeDateTime) {
        deviceHistoryRepository.deleteByModifiedAtBefore(beforeDateTime);
        log.info("날짜별 장비 수정내역 삭제: beforeDateTime={}", beforeDateTime);
    }
    
    /**
     * 특정 학교의 특정 날짜 이전 장비 수정내역 삭제
     */
    @Transactional
    public void deleteDeviceHistoryBySchoolAndDate(Long schoolId, java.time.LocalDateTime beforeDateTime) {
        deviceHistoryRepository.deleteByDeviceSchoolSchoolIdAndModifiedAtBefore(schoolId, beforeDateTime);
        log.info("학교별 날짜별 장비 수정내역 삭제: schoolId={}, beforeDateTime={}", schoolId, beforeDateTime);
    }
}
