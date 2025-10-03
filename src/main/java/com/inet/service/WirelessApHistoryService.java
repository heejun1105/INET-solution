package com.inet.service;

import com.inet.entity.WirelessAp;
import com.inet.entity.WirelessApHistory;
import com.inet.entity.User;
import com.inet.repository.WirelessApHistoryRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class WirelessApHistoryService {
    
    private static final Logger log = LoggerFactory.getLogger(WirelessApHistoryService.class);
    
    private final WirelessApHistoryRepository wirelessApHistoryRepository;
    
    public WirelessApHistoryService(WirelessApHistoryRepository wirelessApHistoryRepository) {
        this.wirelessApHistoryRepository = wirelessApHistoryRepository;
    }
    
    /**
     * 무선AP 수정내역 저장
     */
    @Transactional
    public void saveWirelessApHistory(WirelessAp wirelessAp, String fieldName, String beforeValue, String afterValue, User modifiedBy) {
        if (beforeValue == null) beforeValue = "";
        if (afterValue == null) afterValue = "";
        
        // 값이 실제로 변경된 경우에만 히스토리 저장
        if (!beforeValue.equals(afterValue)) {
            WirelessApHistory history = new WirelessApHistory(wirelessAp, fieldName, beforeValue, afterValue, modifiedBy);
            wirelessApHistoryRepository.save(history);
            log.info("무선AP 수정내역 저장: APID={}, 필드={}, 이전값={}, 변경값={}, 수정자={}", 
                    wirelessAp.getAPId(), fieldName, beforeValue, afterValue, modifiedBy.getName());
        }
    }
    
    /**
     * 무선AP별 수정내역 조회
     */
    public List<WirelessApHistory> getWirelessApHistory(WirelessAp wirelessAp) {
        return wirelessApHistoryRepository.findByWirelessApOrderByModifiedAtDesc(wirelessAp);
    }
    
    /**
     * 학교별 수정내역 조회 (페이징)
     */
    public Page<WirelessApHistory> getWirelessApHistoryBySchool(Long schoolId, int page, int size) {
        Pageable pageable = PageRequest.of(page - 1, size);
        return wirelessApHistoryRepository.findBySchoolId(schoolId, pageable);
    }
    
    /**
     * 학교별 수정내역 조회 (전체)
     */
    public List<WirelessApHistory> getWirelessApHistoryBySchool(Long schoolId) {
        return wirelessApHistoryRepository.findBySchoolId(schoolId);
    }
    
    /**
     * 검색 조건으로 수정내역 조회
     */
    public Page<WirelessApHistory> searchWirelessApHistory(Long schoolId, String keyword, int page, int size) {
        Pageable pageable = PageRequest.of(page - 1, size);
        String mapped = mapKoreanFieldToEnglish(keyword);
        return wirelessApHistoryRepository.findBySchoolIdAndKeyword(schoolId, keyword, mapped, pageable);
    }

    // 한글 표시 필드명을 실제 저장된 영문 필드명으로 매핑하여 검색 정확도 향상
    private String mapKoreanFieldToEnglish(String keyword) {
        if (keyword == null) return null;
        String k = keyword.trim();
        if (k.isEmpty()) return null;
        switch (k) {
            case "설치 위치":
            case "설치 위치 (교실)":
            case "위치":
                return "location";
            case "교실구분":
                return "classroomType";
            case "새 라벨 번호":
            case "신규라벨번호":
            case "라벨번호":
                return "newLabelNumber";
            case "장비 번호":
                return "deviceNumber";
            case "AP 년도":
            case "도입년도":
                return "apYear";
            case "제조사":
                return "manufacturer";
            case "모델명":
            case "모델":
                return "model";
            case "MAC 주소":
            case "맥주소":
                return "macAddress";
            case "이전 위치":
                return "prevLocation";
            case "이전 라벨 번호":
            case "기존라벨번호":
                return "prevLabelNumber";
            case "속도":
                return "speed";
            default:
                return null;
        }
    }
    
    /**
     * 특정 무선AP의 수정내역 삭제
     */
    @Transactional
    public void deleteWirelessApHistory(WirelessAp wirelessAp) {
        wirelessApHistoryRepository.deleteByWirelessAp(wirelessAp);
        log.info("무선AP 수정내역 삭제: APID={}", wirelessAp.getAPId());
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
     * 특정 학교의 무선AP 수정내역 삭제
     */
    @Transactional
    public void deleteWirelessApHistoryBySchool(Long schoolId) {
        wirelessApHistoryRepository.deleteBySchoolId(schoolId);
        log.info("학교별 무선AP 수정내역 삭제: schoolId={}", schoolId);
    }
    
    /**
     * 전체 무선AP 수정내역 삭제
     */
    @Transactional
    public void deleteAllWirelessApHistory() {
        wirelessApHistoryRepository.deleteAll();
        log.info("전체 무선AP 수정내역 삭제 완료");
    }
    
    /**
     * 특정 날짜 이전의 무선AP 수정내역 삭제
     */
    @Transactional
    public void deleteWirelessApHistoryByDate(java.time.LocalDateTime beforeDateTime) {
        wirelessApHistoryRepository.deleteByModifiedAtBefore(beforeDateTime);
        log.info("날짜별 무선AP 수정내역 삭제: beforeDateTime={}", beforeDateTime);
    }
    
    /**
     * 특정 학교의 특정 날짜 이전 무선AP 수정내역 삭제
     */
    @Transactional
    public void deleteWirelessApHistoryBySchoolAndDate(Long schoolId, java.time.LocalDateTime beforeDateTime) {
        wirelessApHistoryRepository.deleteBySchoolIdAndModifiedAtBefore(schoolId, beforeDateTime);
        log.info("학교별 날짜별 무선AP 수정내역 삭제: schoolId={}, beforeDateTime={}", schoolId, beforeDateTime);
    }
}
