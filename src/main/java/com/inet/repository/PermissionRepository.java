package com.inet.repository;

import com.inet.entity.Permission;
import com.inet.entity.User;
import com.inet.entity.Feature;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PermissionRepository extends JpaRepository<Permission, Long> {
    
    // 사용자의 모든 권한 조회
    List<Permission> findByUser(User user);
    
    // 사용자 ID로 권한 조회
    List<Permission> findByUserId(Long userId);
    
    // 특정 기능에 대한 사용자 권한 조회
    List<Permission> findByUserAndFeature(User user, Feature feature);
    
    // 사용자 ID와 기능으로 권한 조회
    List<Permission> findByUserIdAndFeature(Long userId, Feature feature);
    
    // 특정 기능에 대한 모든 사용자 권한 조회
    List<Permission> findByFeature(Feature feature);
    
    // 사용자의 권한 삭제
    void deleteByUser(User user);
    
    // 특정 사용자와 기능의 권한 삭제
    void deleteByUserAndFeature(User user, Feature feature);
    
    // 사용자 ID와 기능으로 권한 삭제
    void deleteByUserIdAndFeature(Long userId, Feature feature);
    
    // 사용자가 특정 기능에 권한을 가지고 있는지 확인
    @Query("SELECT COUNT(p) > 0 FROM Permission p WHERE p.user.id = :userId AND p.feature = :feature")
    boolean existsByUserIdAndFeature(@Param("userId") Long userId, @Param("feature") Feature feature);
} 