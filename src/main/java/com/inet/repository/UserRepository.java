package com.inet.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.inet.entity.User;
import com.inet.entity.UserStatus;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    
    // 아이디로 사용자 찾기
    Optional<User> findByUsername(String username);
    
    // 아이디 존재 여부 확인
    boolean existsByUsername(String username);
    
    // 이메일 존재 여부 확인
    boolean existsByEmail(String email);
    
    // 상태별 사용자 목록 조회
    List<User> findByStatus(UserStatus status);
    
    // 승인 대기 중인 사용자 목록
    List<User> findByStatusOrderByCreatedAtDesc(UserStatus status);
    
    // 역할별 사용자 목록 조회
    List<User> findByRoleOrderByCreatedAtDesc(String role);
    
    // 소속별 사용자 목록 조회
    List<User> findByOrganizationOrderByCreatedAtDesc(String organization);
    
    // 검색 기능 (아이디, 이름, 소속, 직위로 검색)
    @Query("SELECT u FROM User u WHERE u.username LIKE %:keyword% OR u.name LIKE %:keyword% OR u.organization LIKE %:keyword% OR u.position LIKE %:keyword%")
    List<User> findByKeyword(@Param("keyword") String keyword);
    
    // 승인된 사용자만 조회
    @Query("SELECT u FROM User u WHERE u.status = 'APPROVED' ORDER BY u.createdAt DESC")
    List<User> findApprovedUsers();
    
    // 최근 가입한 사용자들 (최근 30일)
    @Query("SELECT u FROM User u WHERE u.createdAt >= :thirtyDaysAgo ORDER BY u.createdAt DESC")
    List<User> findRecentUsers(@Param("thirtyDaysAgo") java.time.LocalDateTime thirtyDaysAgo);
    
    // 아이디 찾기 (이름, 생년월일, 이메일)
    @Query("SELECT u.username FROM User u WHERE u.name = :name AND u.birthDate = :birthDate AND u.email = :email")
    List<String> findUsernamesByInfo(@Param("name") String name, 
                                    @Param("birthDate") String birthDate, 
                                    @Param("email") String email);
    
    // 비밀번호 찾기 (아이디, 이름, 생년월일)
    @Query("SELECT u FROM User u WHERE u.username = :username AND u.name = :name AND u.birthDate = :birthDate")
    Optional<User> findByUsernameAndNameAndBirthDate(@Param("username") String username,
                                                    @Param("name") String name,
                                                    @Param("birthDate") String birthDate);
    
    // 이메일로 사용자 찾기
    Optional<User> findByEmail(String email);
    
    // 특정 학교들에 대한 검사자 목록 조회
    @Query("SELECT DISTINCT u FROM User u " +
           "JOIN u.schoolPermissions sp " +
           "WHERE sp.school.schoolId IN :schoolIds " +
           "ORDER BY u.name")
    List<User> findInspectorsBySchools(@Param("schoolIds") List<Long> schoolIds);
} 