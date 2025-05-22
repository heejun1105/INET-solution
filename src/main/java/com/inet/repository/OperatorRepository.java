package com.inet.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Repository;
import com.inet.entity.Operator;
import java.util.Optional;
import com.inet.entity.School;
import java.util.List;

@Repository
public interface OperatorRepository extends JpaRepository<Operator, Long> {
    Optional<Operator> findByNameAndPositionAndSchool(String name, String position, School school);
    List<Operator> findBySchool(School school);
    
    @Modifying
    @Query("DELETE FROM Operator o WHERE o.school.schoolId = :schoolId")
    int deleteBySchoolSchoolId(Long schoolId);

    @Query("SELECT COUNT(o) FROM Operator o WHERE o.school.schoolId = :schoolId")
    long countBySchoolSchoolId(Long schoolId);

    @Query("SELECT o FROM Operator o WHERE o.school.schoolId = :schoolId")
    List<Operator> findBySchoolSchoolId(Long schoolId);
} 