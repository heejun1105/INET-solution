package com.inet.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import com.inet.entity.User;
import com.inet.entity.UserRole;
import com.inet.entity.UserStatus;
import com.inet.repository.UserRepository;

import java.time.LocalDateTime;
import java.util.Optional;

// 운영 환경에서는 Flyway 마이그레이션(V5__create_admin_account.sql)에서 관리자 계정을 생성하므로
// 이 클래스는 비활성화합니다.
// 개발 환경에서만 사용하려면 아래 주석을 해제하고 @Component를 활성화하세요.
// @Component
// @ConditionalOnProperty(name = "app.admin-initializer.enabled", havingValue = "true", matchIfMissing = false)
// @Deprecated
public class AdminAccountInitializer implements CommandLineRunner {

    @Autowired
    private UserRepository userRepository;
    
    @Autowired
    private PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) throws Exception {
        // 관리자 계정이 없으면 생성
        Optional<User> adminUser = userRepository.findByUsername("admin");
        
        if (adminUser.isEmpty()) {
            User admin = new User();
            admin.setUsername("admin");
            admin.setPassword(passwordEncoder.encode("admin123!"));
            admin.setName("관리자");
            admin.setRole(UserRole.ADMIN);
            admin.setStatus(UserStatus.APPROVED);
            admin.setBirthDate("1990-01-01");
            admin.setOrganization("I-NET 시스템");
            admin.setPosition("시스템 관리자");
            admin.setPhoneNumber("010-0000-0000");
            admin.setEmail("admin@inet.com");
            admin.setCreatedAt(LocalDateTime.now());
            admin.setApprovedAt(LocalDateTime.now());
            admin.setApprovedBy("SYSTEM");
            
            userRepository.save(admin);
        } else {
            // 이미 관리자 계정이 존재하는 경우 아무 작업도 수행하지 않음
        }
    }
} 