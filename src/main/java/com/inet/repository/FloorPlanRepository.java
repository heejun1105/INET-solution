package com.inet.repository;

import com.inet.entity.FloorPlan;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

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
} 