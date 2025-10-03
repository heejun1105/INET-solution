package com.inet.repository;

import com.inet.entity.DeviceInspectionHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.data.domain.Pageable;

import java.util.List;

@Repository
public interface DeviceInspectionHistoryRepository extends JpaRepository<DeviceInspectionHistory, Long> {
    
    // 학교별 검사 이력 조회
    List<DeviceInspectionHistory> findBySchoolIdOrderByInspectionDateDesc(Long schoolId);
    
    // 검사자별 검사 이력 조회
    List<DeviceInspectionHistory> findByInspectorIdOrderByInspectionDateDesc(Long inspectorId);
    
    // 학교와 검사자별 검사 이력 조회
    List<DeviceInspectionHistory> findBySchoolIdAndInspectorIdOrderByInspectionDateDesc(Long schoolId, Long inspectorId);
    
    // 최근 검사 이력 조회 (상위 N개)
    @Query("SELECT d FROM DeviceInspectionHistory d ORDER BY d.inspectionDate DESC")
    List<DeviceInspectionHistory> findRecentInspections(Pageable pageable);
    
    // 학교별 최근 검사 이력 조회
    @Query("SELECT d FROM DeviceInspectionHistory d WHERE d.schoolId = :schoolId ORDER BY d.inspectionDate DESC")
    List<DeviceInspectionHistory> findRecentInspectionsBySchool(@Param("schoolId") Long schoolId, Pageable pageable);
}
