package com.inet.repository;

import com.inet.entity.Classroom;
import com.inet.entity.School;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ClassroomRepository extends JpaRepository<Classroom, Long> {
    List<Classroom> findBySchoolSchoolId(Long schoolId);
    Optional<Classroom> findByRoomNameAndSchool(String roomName, School school);
    
    // 기존 메서드는 Deprecated 처리
    @Deprecated
    Classroom findByRoomName(String roomName);
} 