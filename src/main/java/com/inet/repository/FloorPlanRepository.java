package com.inet.repository;

import com.inet.entity.FloorPlan;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FloorPlanRepository extends JpaRepository<FloorPlan, Long> {
    
    /**
     * 학교별 활성화된 평면도 조회
     */
    @Query("SELECT fp FROM FloorPlan fp WHERE fp.schoolId = :schoolId AND fp.isActive = true")
    Optional<FloorPlan> findBySchoolIdAndActive(@Param("schoolId") Long schoolId);
    
    /**
     * 학교별 모든 평면도 조회 (활성화 여부 관계없이)
     */
    @Query("SELECT fp FROM FloorPlan fp WHERE fp.schoolId = :schoolId ORDER BY fp.updatedAt DESC")
    List<FloorPlan> findAllBySchoolId(@Param("schoolId") Long schoolId);
    
    /**
     * 학교별 평면도 존재 여부 확인
     */
    @Query("SELECT COUNT(fp) > 0 FROM FloorPlan fp WHERE fp.schoolId = :schoolId AND fp.isActive = true")
    boolean existsBySchoolIdAndActive(@Param("schoolId") Long schoolId);
    
    /**
     * 학교별 평면도 개수 조회
     */
    @Query("SELECT COUNT(fp) FROM FloorPlan fp WHERE fp.schoolId = :schoolId")
    long countBySchoolId(@Param("schoolId") Long schoolId);
} 