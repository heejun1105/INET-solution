package com.inet.repository;

import com.inet.entity.FloorPlan;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Repository
public interface FloorPlanRepository extends JpaRepository<FloorPlan, Long> {
    
    /**
     * 학교별 모든 평면도 조회
     */
    List<FloorPlan> findAllBySchoolId(Long schoolId);
    
    /**
     * 학교별 활성 평면도 조회
     */
    List<FloorPlan> findAllBySchoolIdAndIsActive(Long schoolId, Boolean isActive);
    
    /**
     * 학교별 활성 평면도 조회 (단일)
     */
    Optional<FloorPlan> findBySchoolIdAndIsActive(Long schoolId, Boolean isActive);
    
    /**
     * 학교별 모든 평면도 삭제
     */
    @Modifying
    @Transactional
    @Query("DELETE FROM FloorPlan fp WHERE fp.schoolId = :schoolId")
    int deleteBySchoolId(@Param("schoolId") Long schoolId);
} 