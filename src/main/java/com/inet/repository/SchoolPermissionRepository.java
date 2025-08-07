package com.inet.repository;

import com.inet.entity.SchoolPermission;
import com.inet.entity.User;
import com.inet.entity.School;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SchoolPermissionRepository extends JpaRepository<SchoolPermission, Long> {
    
    // 사용자의 모든 학교 권한 조회
    List<SchoolPermission> findByUser(User user);
    
    // 사용자 ID로 학교 권한 조회
    List<SchoolPermission> findByUserId(Long userId);
    
    // 특정 학교에 대한 사용자 권한 조회
    List<SchoolPermission> findByUserAndSchool(User user, School school);
    
    // 사용자 ID와 학교 ID로 권한 조회 (명시적 쿼리 사용)
    @Query("SELECT sp FROM SchoolPermission sp WHERE sp.user.id = :userId AND sp.school.schoolId = :schoolId")
    Optional<SchoolPermission> findByUserIdAndSchoolId(@Param("userId") Long userId, @Param("schoolId") Long schoolId);
    
    // 특정 학교에 대한 모든 사용자 권한 조회
    List<SchoolPermission> findBySchool(School school);
    
    // 사용자의 학교 권한 삭제
    void deleteByUser(User user);
    
    // 특정 사용자와 학교의 권한 삭제
    void deleteByUserAndSchool(User user, School school);
    
    // 사용자 ID와 학교 ID로 권한 삭제 (명시적 쿼리 사용)
    @Query("DELETE FROM SchoolPermission sp WHERE sp.user.id = :userId AND sp.school.schoolId = :schoolId")
    void deleteByUserIdAndSchoolId(@Param("userId") Long userId, @Param("schoolId") Long schoolId);
    
    // 사용자가 접근 가능한 학교 ID 목록 조회
    @Query("SELECT sp.school.schoolId FROM SchoolPermission sp WHERE sp.user.id = :userId")
    List<Long> findSchoolIdsByUserId(@Param("userId") Long userId);
    
    // 사용자가 특정 학교에 접근 권한이 있는지 확인
    @Query("SELECT COUNT(sp) > 0 FROM SchoolPermission sp WHERE sp.user.id = :userId AND sp.school.schoolId = :schoolId")
    boolean existsByUserIdAndSchoolId(@Param("userId") Long userId, @Param("schoolId") Long schoolId);
} 