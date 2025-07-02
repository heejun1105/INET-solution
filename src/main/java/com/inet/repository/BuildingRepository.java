package com.inet.repository;

import com.inet.entity.Building;
import com.inet.entity.School;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface BuildingRepository extends JpaRepository<Building, Long> {
    
    List<Building> findBySchool(School school);
    
    List<Building> findBySchoolSchoolId(Long schoolId);
    
    @Query("SELECT b FROM Building b WHERE b.school.schoolId = :schoolId ORDER BY b.buildingName")
    List<Building> findBySchoolIdOrderByName(@Param("schoolId") Long schoolId);
    
    boolean existsBySchoolAndBuildingName(School school, String buildingName);
} 