package com.inet.repository;

import com.inet.entity.DeviceInspectionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Repository
public interface DeviceInspectionStatusRepository extends JpaRepository<DeviceInspectionStatus, Long> {
    
    // 특정 장비의 현재 검사 상태 조회
    Optional<DeviceInspectionStatus> findByDeviceIdAndSchoolIdAndInspectorId(
        Long deviceId, Long schoolId, Long inspectorId
    );
    
    // 특정 학교의 모든 검사 상태들 조회
    List<DeviceInspectionStatus> findBySchoolIdAndInspectorId(
        Long schoolId, Long inspectorId
    );
    
    // 특정 장비의 검사 상태 삭제
    void deleteByDeviceIdAndSchoolIdAndInspectorId(
        Long deviceId, Long schoolId, Long inspectorId
    );
    
    // 학교별 모든 검사 상태 삭제
    @Modifying
    @Transactional
    @Query("DELETE FROM DeviceInspectionStatus dis WHERE dis.schoolId = :schoolId")
    int deleteBySchoolId(@Param("schoolId") Long schoolId);
}
