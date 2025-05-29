package com.inet.repository;

import com.inet.entity.WirelessAp;
import com.inet.entity.Classroom;
import com.inet.entity.School;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface WirelessApRepository extends JpaRepository<WirelessAp, Long> {
    List<WirelessAp> findByLocation(Classroom location);
    List<WirelessAp> findBySchool(School school);
    List<WirelessAp> findBySchoolOrderByLocationRoomNameAsc(School school);
    
    // 학교별 개수 조회
    long countBySchoolSchoolId(Long schoolId);
    
    // 학교별 데이터 삭제
    @Modifying
    @Query("DELETE FROM WirelessAp w WHERE w.school.schoolId = :schoolId")
    int deleteBySchoolSchoolId(@Param("schoolId") Long schoolId);
} 