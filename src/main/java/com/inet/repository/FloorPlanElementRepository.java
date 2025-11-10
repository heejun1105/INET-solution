package com.inet.repository;

import com.inet.entity.FloorPlanElement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface FloorPlanElementRepository extends JpaRepository<FloorPlanElement, Long> {
    
    /**
     * 평면도별 모든 요소 조회
     */
    @Query("SELECT fpe FROM FloorPlanElement fpe WHERE fpe.floorPlanId = :floorPlanId ORDER BY fpe.zIndex ASC, fpe.id ASC")
    List<FloorPlanElement> findByFloorPlanId(@Param("floorPlanId") Long floorPlanId);
    
    /**
     * 평면도별 특정 타입의 요소 조회
     */
    @Query("SELECT fpe FROM FloorPlanElement fpe WHERE fpe.floorPlanId = :floorPlanId AND fpe.elementType = :elementType ORDER BY fpe.zIndex ASC, fpe.id ASC")
    List<FloorPlanElement> findByFloorPlanIdAndElementType(@Param("floorPlanId") Long floorPlanId, @Param("elementType") String elementType);
    
    /**
     * 평면도별 참조 ID로 요소 조회
     */
    @Query("SELECT fpe FROM FloorPlanElement fpe WHERE fpe.floorPlanId = :floorPlanId AND fpe.referenceId = :referenceId AND fpe.elementType = :elementType")
    FloorPlanElement findByFloorPlanIdAndReferenceIdAndElementType(@Param("floorPlanId") Long floorPlanId, @Param("referenceId") Long referenceId, @Param("elementType") String elementType);
    
    /**
     * 평면도 요소 삭제
     */
    @Modifying
    @Query("DELETE FROM FloorPlanElement fpe WHERE fpe.floorPlanId = :floorPlanId")
    void deleteByFloorPlanId(@Param("floorPlanId") Long floorPlanId);
    
    /**
     * 평면도별 요소 개수 조회
     */
    @Query("SELECT COUNT(fpe) FROM FloorPlanElement fpe WHERE fpe.floorPlanId = :floorPlanId")
    long countByFloorPlanId(@Param("floorPlanId") Long floorPlanId);
    
    /**
     * 특정 참조 ID를 가진 모든 요소 조회 (여러 평면도에서)
     */
    @Query("SELECT fpe FROM FloorPlanElement fpe WHERE fpe.referenceId = :referenceId AND fpe.elementType = :elementType")
    List<FloorPlanElement> findByReferenceIdAndElementType(@Param("referenceId") Long referenceId, @Param("elementType") String elementType);
    
    /**
     * 참조 ID가 일치하는 모든 요소 조회
     */
    @Query("SELECT fpe FROM FloorPlanElement fpe WHERE fpe.referenceId = :referenceId")
    List<FloorPlanElement> findByReferenceId(@Param("referenceId") Long referenceId);
    
    /**
     * 부모 요소 ID로 자식 요소 조회
     */
    @Query("SELECT fpe FROM FloorPlanElement fpe WHERE fpe.parentElementId = :parentElementId")
    List<FloorPlanElement> findByParentElementId(@Param("parentElementId") Long parentElementId);
} 