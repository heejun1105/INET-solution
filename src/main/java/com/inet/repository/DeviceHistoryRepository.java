package com.inet.repository;

import com.inet.entity.DeviceHistory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DeviceHistoryRepository extends JpaRepository<DeviceHistory, Long> {
    
    // 장비별 수정내역 조회
    List<DeviceHistory> findByDeviceOrderByModifiedAtDesc(com.inet.entity.Device device);
    
    // 학교별 수정내역 조회 (페이징)
    @Query("SELECT dh FROM DeviceHistory dh WHERE dh.device.school.schoolId = :schoolId ORDER BY dh.modifiedAt DESC")
    Page<DeviceHistory> findBySchoolId(@Param("schoolId") Long schoolId, Pageable pageable);
    
    // 학교별 수정내역 조회 (전체)
    @Query("SELECT dh FROM DeviceHistory dh WHERE dh.device.school.schoolId = :schoolId ORDER BY dh.modifiedAt DESC")
    List<DeviceHistory> findBySchoolId(@Param("schoolId") Long schoolId);
    
    // 검색 조건으로 수정내역 조회
    @Query("SELECT dh FROM DeviceHistory dh WHERE dh.device.school.schoolId = :schoolId " +
           "AND (:searchType IS NULL OR dh.device.type = :searchType) " +
           "AND (:searchKeyword IS NULL OR dh.device.modelName LIKE %:searchKeyword% " +
           "OR dh.device.manufacturer LIKE %:searchKeyword% " +
           "OR dh.device.ipAddress LIKE %:searchKeyword%) " +
           "ORDER BY dh.modifiedAt DESC")
    Page<DeviceHistory> findBySchoolIdAndSearchConditions(
        @Param("schoolId") Long schoolId,
        @Param("searchType") String searchType,
        @Param("searchKeyword") String searchKeyword,
        Pageable pageable
    );
    
    // 모든 장비 유형 조회
    @Query("SELECT DISTINCT dh.device.type FROM DeviceHistory dh WHERE dh.device.type IS NOT NULL ORDER BY dh.device.type")
    List<String> findAllDeviceTypes();
}
