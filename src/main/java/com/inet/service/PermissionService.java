package com.inet.service;

import com.inet.entity.Permission;
import com.inet.entity.User;
import com.inet.entity.Feature;
import com.inet.entity.UserRole;
import com.inet.repository.PermissionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
@Transactional
public class PermissionService {
    
    @Autowired
    private PermissionRepository permissionRepository;
    
    // 사용자에게 기능 권한 부여
    public Permission grantPermission(User user, Feature feature) {
        // 이미 권한이 있는지 확인
        Optional<Permission> existing = permissionRepository.findByUserIdAndFeature(user.getId(), feature)
            .stream().findFirst();
        if (existing.isPresent()) {
            return existing.get();
        }
        
        Permission permission = new Permission(user, feature);
        return permissionRepository.save(permission);
    }
    
    // 사용자의 기능 권한 삭제
    public void revokePermission(User user, Feature feature) {
        permissionRepository.deleteByUserIdAndFeature(user.getId(), feature);
    }
    
    // 사용자의 모든 권한 삭제
    public void revokeAllPermissions(User user) {
        permissionRepository.deleteByUser(user);
    }
    
    // 사용자가 특정 기능에 권한을 가지고 있는지 확인
    public boolean hasPermission(User user, Feature feature) {
        // 관리자도 권한관리에서 지정한 권한만 접근 가능
        return permissionRepository.existsByUserIdAndFeature(user.getId(), feature);
    }
    
    // 사용자의 모든 권한 조회
    public List<Permission> getUserPermissions(User user) {
        return permissionRepository.findByUser(user);
    }
    
    // 사용자 ID로 권한 조회
    public List<Permission> getUserPermissions(Long userId) {
        return permissionRepository.findByUserId(userId);
    }
    
    // 사용자의 특정 기능 권한 조회
    public List<Permission> getUserPermissions(User user, Feature feature) {
        return permissionRepository.findByUserAndFeature(user, feature);
    }
} 