package com.inet.aspect;

import java.lang.reflect.Method;

import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import com.inet.annotation.RequirePermission;
import com.inet.entity.Feature;
import com.inet.entity.School;
import com.inet.entity.User;
import com.inet.service.PermissionService;
import com.inet.service.SchoolPermissionService;
import com.inet.service.UserService;
import com.inet.repository.SchoolRepository;

@Aspect
@Component
public class PermissionAspect {
    
    @Autowired
    private PermissionService permissionService;
    
    @Autowired
    private SchoolPermissionService schoolPermissionService;
    
    @Autowired
    private UserService userService;
    
    @Autowired
    private SchoolRepository schoolRepository;
    
    @Around("@annotation(com.inet.annotation.RequirePermission)")
    public Object checkPermission(ProceedingJoinPoint joinPoint) throws Throwable {
        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        Method method = signature.getMethod();
        RequirePermission annotation = method.getAnnotation(RequirePermission.class);
        
        // 현재 인증된 사용자 정보 가져오기
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new RuntimeException("인증이 필요합니다.");
        }
        
        String username = authentication.getName();
        User user = userService.findByUsername(username)
            .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));
        
        // 기능 권한 확인
        Feature feature = Feature.valueOf(annotation.feature());
        
        boolean hasFeaturePermission = permissionService.hasPermission(user, feature);
        
        if (!hasFeaturePermission) {
            throw new RuntimeException("해당 기능에 대한 권한이 없습니다.");
        }
        
        // 학교 권한 확인 (schoolParam이 지정된 경우)
        if (!annotation.schoolParam().isEmpty()) {
            Object[] args = joinPoint.getArgs();
            String[] paramNames = signature.getParameterNames();
            
            School school = null;
            for (int i = 0; i < paramNames.length; i++) {
                if (paramNames[i].equals(annotation.schoolParam())) {
                    if (args[i] instanceof Long) {
                        Long schoolId = (Long) args[i];
                        school = schoolRepository.findById(schoolId).orElse(null);
                    } else if (args[i] instanceof School) {
                        school = (School) args[i];
                    }
                    break;
                }
            }
            
            if (school != null) {
                boolean hasSchoolPermission = schoolPermissionService.hasSchoolPermission(user, school);
                if (!hasSchoolPermission) {
                    throw new RuntimeException("해당 학교에 대한 접근 권한이 없습니다.");
                }
            }
        }
        
        return joinPoint.proceed();
    }
} 