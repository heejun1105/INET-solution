package com.inet.service;

import com.inet.entity.SchoolPermission;
import com.inet.entity.User;
import com.inet.entity.School;
import com.inet.entity.UserRole;
import com.inet.repository.SchoolPermissionRepository;
import com.inet.repository.SchoolRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
@Transactional
public class SchoolPermissionService {
    
    @Autowired
    private SchoolPermissionRepository schoolPermissionRepository;
    
    @Autowired
    private SchoolRepository schoolRepository;
    
    // 사용자에게 학교 접근권한 부여
    public SchoolPermission grantSchoolPermission(User user, School school) {
        // 이미 권한이 있는지 확인
        Optional<SchoolPermission> existing = schoolPermissionRepository.findByUserIdAndSchoolId(user.getId(), school.getSchoolId());
        if (existing.isPresent()) {
            return existing.get();
        }
        
        SchoolPermission schoolPermission = new SchoolPermission(user, school);
        return schoolPermissionRepository.save(schoolPermission);
    }
    
    // 사용자에게 여러 학교 접근권한 부여
    public List<SchoolPermission> grantSchoolPermissions(User user, List<Long> schoolIds) {
        List<School> schools = schoolRepository.findAllById(schoolIds);
        List<SchoolPermission> permissions = new java.util.ArrayList<>();
        
        for (School school : schools) {
            permissions.add(grantSchoolPermission(user, school));
        }
        
        return permissions;
    }
    
    // 사용자의 학교 접근권한 삭제
    public void revokeSchoolPermission(User user, School school) {
        schoolPermissionRepository.deleteByUserAndSchool(user, school);
    }
    
    // 사용자의 특정 학교 접근권한 삭제
    public void revokeSchoolPermission(Long userId, Long schoolId) {
        schoolPermissionRepository.deleteByUserIdAndSchoolId(userId, schoolId);
    }
    
    // 사용자의 모든 학교 접근권한 삭제
    public void revokeAllSchoolPermissions(User user) {
        schoolPermissionRepository.deleteByUser(user);
    }
    
    // 사용자의 모든 학교 접근권한 조회
    public List<SchoolPermission> getUserSchoolPermissions(User user) {
        return schoolPermissionRepository.findByUser(user);
    }
    
    // 사용자 ID로 학교 접근권한 조회
    public List<SchoolPermission> getUserSchoolPermissions(Long userId) {
        return schoolPermissionRepository.findByUserId(userId);
    }
    
    // 사용자가 특정 학교에 접근권한이 있는지 확인
    public boolean hasSchoolPermission(User user, School school) {
        // 관리자도 권한관리에서 지정한 학교만 접근 가능
        return schoolPermissionRepository.existsByUserIdAndSchoolId(user.getId(), school.getSchoolId());
    }
    
    // 사용자가 특정 학교에 접근권한이 있는지 확인 (ID로)
    public boolean hasSchoolPermission(Long userId, Long schoolId) {
        return schoolPermissionRepository.existsByUserIdAndSchoolId(userId, schoolId);
    }
    
    // 사용자가 접근 가능한 학교 ID 목록 조회
    public List<Long> getAccessibleSchoolIds(User user) {
        // 관리자도 권한관리에서 지정한 학교만 접근 가능
        return schoolPermissionRepository.findSchoolIdsByUserId(user.getId());
    }
    
    // 사용자가 접근 가능한 학교 목록 조회
    public List<School> getAccessibleSchools(User user) {
        // 관리자도 권한관리에서 지정한 학교만 접근 가능
        List<Long> schoolIds = getAccessibleSchoolIds(user);
        return schoolRepository.findAllById(schoolIds);
    }
    
    // 모든 학교 목록 조회 (권한 관리용)
    public List<School> getAllSchools() {
        return schoolRepository.findAll();
    }
} 