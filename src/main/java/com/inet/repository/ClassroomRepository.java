package com.inet.repository;

import com.inet.entity.Classroom;
import com.inet.entity.School;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface ClassroomRepository extends JpaRepository<Classroom, Long> {
    List<Classroom> findBySchool(School school);
    Optional<Classroom> findByRoomNameAndSchool(String roomName, School school);
    Optional<Classroom> findFirstByRoomNameAndSchool(String roomName, School school);
    
    // 기존 메서드는 Deprecated 처리
    @Deprecated
    Classroom findByRoomName(String roomName);

    @Modifying
    @Query("DELETE FROM Classroom c WHERE c.school.schoolId = :schoolId")
    int deleteBySchoolSchoolId(Long schoolId);

    @Query("SELECT COUNT(c) FROM Classroom c WHERE c.school.schoolId = :schoolId")
    long countBySchoolSchoolId(Long schoolId);

    @Query("SELECT c FROM Classroom c WHERE c.school.schoolId = :schoolId")
    List<Classroom> findBySchoolSchoolId(Long schoolId);
    
    @Query("SELECT c FROM Classroom c WHERE c.school.schoolId = :schoolId ORDER BY c.roomName ASC")
    List<Classroom> findBySchoolSchoolIdOrderByRoomNameAsc(Long schoolId);
} 