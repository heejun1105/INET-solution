package com.inet.repository;

import com.inet.entity.WirelessApHistory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Repository
public interface WirelessApHistoryRepository extends JpaRepository<WirelessApHistory, Long> {
    
    // 무선AP별 수정내역 조회
    List<WirelessApHistory> findByWirelessApOrderByModifiedAtDesc(com.inet.entity.WirelessAp wirelessAp);
    
    // 학교별 수정내역 조회 (페이징)
    @Query("SELECT wah FROM WirelessApHistory wah " +
           "WHERE wah.wirelessAp.school.schoolId = :schoolId " +
           "ORDER BY wah.modifiedAt DESC")
    Page<WirelessApHistory> findBySchoolId(@Param("schoolId") Long schoolId, Pageable pageable);
    
    // 학교별 수정내역 조회 (전체)
    @Query("SELECT wah FROM WirelessApHistory wah " +
           "WHERE wah.wirelessAp.school.schoolId = :schoolId " +
           "ORDER BY wah.modifiedAt DESC")
    List<WirelessApHistory> findBySchoolId(@Param("schoolId") Long schoolId);
    
    // 검색 조건으로 수정내역 조회 (표시되는 주요 필드 포함, 대소문자 무시)
    @Query("SELECT wah FROM WirelessApHistory wah " +
           "LEFT JOIN wah.wirelessAp wa " +
           "LEFT JOIN wa.location loc " +
           "LEFT JOIN wa.school sch " +
           "WHERE sch.schoolId = :schoolId " +
           "AND (" +
           "     LOWER(wah.fieldName) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
           "     (:mappedFieldKeyword IS NOT NULL AND LOWER(wah.fieldName) LIKE LOWER(CONCAT('%', :mappedFieldKeyword, '%'))) OR " +
           "     LOWER(wah.beforeValue) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
           "     LOWER(wah.afterValue) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
           "     LOWER(wah.modifiedBy.name) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
           "     LOWER(wa.newLabelNumber) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
           "     LOWER(wa.deviceNumber) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
           "     LOWER(wa.manufacturer) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
           "     LOWER(wa.model) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
           "     LOWER(wa.prevLocation) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
           "     LOWER(wa.prevLabelNumber) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
           "     LOWER(wa.speed) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
           "     LOWER(COALESCE(loc.roomName, '')) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
           "     LOWER(COALESCE(sch.schoolName, '')) LIKE LOWER(CONCAT('%', :keyword, '%')) " +
           ") " +
           "ORDER BY wah.modifiedAt DESC")
    Page<WirelessApHistory> findBySchoolIdAndKeyword(@Param("schoolId") Long schoolId,
                                                     @Param("keyword") String keyword,
                                                     @Param("mappedFieldKeyword") String mappedFieldKeyword,
                                                     Pageable pageable);
    
    // 특정 무선AP의 수정내역 삭제
    @Modifying
    @Transactional
    void deleteByWirelessAp(com.inet.entity.WirelessAp wirelessAp);
    
    // 특정 학교의 무선AP 수정내역 삭제
    @Modifying
    @Transactional
    @Query("DELETE FROM WirelessApHistory wah WHERE wah.wirelessAp.school.schoolId = :schoolId")
    int deleteBySchoolId(@Param("schoolId") Long schoolId);
    
    // 특정 날짜 이전 무선AP 수정내역 삭제
    @Modifying
    @Transactional
    @Query("DELETE FROM WirelessApHistory wah WHERE wah.modifiedAt < :beforeDateTime")
    void deleteByModifiedAtBefore(@Param("beforeDateTime") java.time.LocalDateTime beforeDateTime);
    
    // 특정 학교의 특정 날짜 이전 무선AP 수정내역 삭제
    @Modifying
    @Transactional
    @Query("DELETE FROM WirelessApHistory wah WHERE wah.wirelessAp.school.schoolId = :schoolId AND wah.modifiedAt < :beforeDateTime")
    int deleteBySchoolIdAndModifiedAtBefore(@Param("schoolId") Long schoolId, @Param("beforeDateTime") java.time.LocalDateTime beforeDateTime);
    
    // 학교별 무선AP 수정내역 개수 조회
    @Query("SELECT COUNT(wah) FROM WirelessApHistory wah WHERE wah.wirelessAp.school.schoolId = :schoolId")
    long countByWirelessApSchoolSchoolId(@Param("schoolId") Long schoolId);
}
