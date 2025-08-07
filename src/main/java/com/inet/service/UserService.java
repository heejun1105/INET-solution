package com.inet.service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.inet.entity.User;
import com.inet.entity.UserRole;
import com.inet.entity.UserStatus;
import com.inet.repository.UserRepository;

@Service
@Transactional
public class UserService {
    
    @Autowired
    private UserRepository userRepository;
    
    @Autowired
    private PasswordEncoder passwordEncoder;
    
    // 회원가입
    public User registerUser(String username, String password, String name, String birthDate, 
                           String organization, String position, String phoneNumber, String email,
                           String securityQuestion, String securityAnswer) {
        
        // 아이디 중복 체크
        if (userRepository.existsByUsername(username)) {
            throw new RuntimeException("이미 존재하는 아이디입니다.");
        }
        
        // 이메일 중복 체크
        if (userRepository.existsByEmail(email)) {
            throw new RuntimeException("이미 존재하는 이메일입니다.");
        }
        
        // 비밀번호 유효성 검사
        if (!isValidPassword(password)) {
            throw new RuntimeException("비밀번호는 7자 이상이며 특수문자를 포함해야 합니다.");
        }
        
        // 비밀번호 암호화
        String encodedPassword = passwordEncoder.encode(password);
        
        // 사용자 생성 (역할은 기본값 EMPLOYEE, 관리자가 승인할 때 변경)
        User user = new User(username, encodedPassword, name, birthDate, organization, position, phoneNumber, email, securityQuestion, securityAnswer);
        // 기본 역할은 EMPLOYEE로 설정 (User 엔티티에서 기본값 설정됨)
        
        return userRepository.save(user);
    }
    
    // 로그인
    public Optional<User> login(String username, String password) {
        Optional<User> userOpt = userRepository.findByUsername(username);
        
        if (userOpt.isPresent()) {
            User user = userOpt.get();
            
            // 승인 상태 확인
            if (user.getStatus() != UserStatus.APPROVED) {
                throw new RuntimeException("승인되지 않은 계정입니다. 관리자 승인을 기다려주세요.");
            }
            
            // 비밀번호 확인
            if (passwordEncoder.matches(password, user.getPassword())) {
                // 마지막 로그인 시간 업데이트
                user.setLastLoginAt(LocalDateTime.now());
                userRepository.save(user);
                return userOpt;
            }
        }
        
        return Optional.empty();
    }
    
    // 사용자 승인
    public User approveUser(Long userId, String approvedBy, String role) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));
        
        // 역할 유효성 검사
        UserRole userRole;
        try {
            userRole = UserRole.valueOf(role);
            if (userRole == UserRole.ADMIN) {
                throw new RuntimeException("관리자 역할은 승인 시 설정할 수 없습니다.");
            }
        } catch (IllegalArgumentException e) {
            throw new RuntimeException("유효하지 않은 역할입니다.");
        }
        
        user.setStatus(UserStatus.APPROVED);
        user.setApprovedAt(LocalDateTime.now());
        user.setApprovedBy(approvedBy);
        user.setRole(userRole);
        
        return userRepository.save(user);
    }
    
    // 사용자 거부 (데이터베이스에서 완전히 삭제)
    public void rejectUser(Long userId, String rejectedBy) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));
        
        // 사용자 삭제 (관련 권한들도 함께 삭제됨 - CascadeType.ALL)
        userRepository.delete(user);
    }
    
    // 사용자 정지
    public User suspendUser(Long userId, String suspendedBy) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));
        
        user.setStatus(UserStatus.SUSPENDED);
        user.setApprovedBy(suspendedBy);
        
        return userRepository.save(user);
    }
    
    // 사용자 역할 변경
    public User changeUserRole(Long userId, UserRole newRole) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));
        
        user.setRole(newRole);
        
        return userRepository.save(user);
    }
    
    // 사용자 정보 수정
    public User updateUserInfo(Long userId, String name, String birthDate, String organization, 
                              String position, String phoneNumber, String email) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));
        
        user.setName(name);
        user.setBirthDate(birthDate);
        user.setOrganization(organization);
        user.setPosition(position);
        user.setPhoneNumber(phoneNumber);
        user.setEmail(email);
        
        return userRepository.save(user);
    }
    
    // 비밀번호 변경 (현재 비밀번호 확인 포함)
    public User changePassword(Long userId, String currentPassword, String newPassword) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));
        
        // 현재 비밀번호 확인
        if (!passwordEncoder.matches(currentPassword, user.getPassword())) {
            throw new RuntimeException("현재 비밀번호가 일치하지 않습니다.");
        }
        
        // 새 비밀번호 유효성 검사
        if (!isValidPassword(newPassword)) {
            throw new RuntimeException("비밀번호는 7자 이상이며 특수문자를 포함해야 합니다.");
        }
        
        // 새 비밀번호 암호화 및 저장
        user.setPassword(passwordEncoder.encode(newPassword));
        
        return userRepository.save(user);
    }
    
    // 비밀번호 변경 (현재 비밀번호 확인 없이)
    public User updatePassword(Long userId, String newPassword) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));
        
        // 새 비밀번호 유효성 검사
        if (!isValidPassword(newPassword)) {
            throw new RuntimeException("비밀번호는 7자 이상이며 특수문자를 포함해야 합니다.");
        }
        
        // 새 비밀번호 암호화 및 저장
        user.setPassword(passwordEncoder.encode(newPassword));
        
        return userRepository.save(user);
    }
    
    // 사용자 삭제 (회원 탈퇴)
    public void deleteUser(Long userId, String deletedBy) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));
        
        // 본인 탈퇴 방지
        if (user.getUsername().equals(deletedBy)) {
            throw new RuntimeException("본인을 탈퇴시킬 수 없습니다.");
        }
        
        // 관리자 계정 탈퇴 방지
        if (user.getRole() == UserRole.ADMIN) {
            throw new RuntimeException("관리자 계정은 탈퇴시킬 수 없습니다.");
        }
        
        // 사용자 삭제 (관련 권한들도 함께 삭제됨 - CascadeType.ALL)
        userRepository.delete(user);
    }
    
    // 승인 대기 중인 사용자 목록
    public List<User> getPendingUsers() {
        return userRepository.findByStatusOrderByCreatedAtDesc(UserStatus.PENDING);
    }
    
    // 승인된 사용자 목록
    public List<User> getApprovedUsers() {
        return userRepository.findApprovedUsers();
    }
    
    // 모든 사용자 목록
    public List<User> getAllUsers() {
        return userRepository.findAll();
    }
    
    // 키워드로 사용자 검색
    public List<User> searchUsers(String keyword) {
        return userRepository.findByKeyword(keyword);
    }
    
    // 최근 가입한 사용자들 (최근 30일)
    public List<User> findRecentUsers() {
        java.time.LocalDateTime thirtyDaysAgo = java.time.LocalDateTime.now().minusDays(30);
        return userRepository.findRecentUsers(thirtyDaysAgo);
    }
    
    // ID로 사용자 찾기
    public Optional<User> findById(Long id) {
        return userRepository.findById(id);
    }
    
    // 아이디로 사용자 찾기
    public Optional<User> findByUsername(String username) {
        return userRepository.findByUsername(username);
    }
    
    // 마지막 로그인 시간 업데이트
    public void updateLastLoginTime(String username) {
        Optional<User> userOpt = userRepository.findByUsername(username);
        if (userOpt.isPresent()) {
            User user = userOpt.get();
            user.setLastLoginAt(LocalDateTime.now());
            userRepository.save(user);
        }
    }
    
    // 사용자 권한 업데이트 (기존 메서드 제거 - 새로운 권한 시스템 사용)
    // public User updateUserPermissions(Long userId, String permissions) {
    //     User user = userRepository.findById(userId)
    //         .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));
    //     
    //     user.setPermissions(permissions);
    //     
    //     return userRepository.save(user);
    // }
    
    // 사용자 권한 조회 (기존 메서드 제거 - 새로운 권한 시스템 사용)
    // public String getUserPermissions(Long userId) {
    //     User user = userRepository.findById(userId)
    //         .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));
    //     
    //     String permissions = user.getPermissions();
    //     return permissions != null ? permissions : "[]";
    // }
    
    // 아이디 찾기
    public List<String> findUsernames(String name, String birthDate, String email) {
        return userRepository.findUsernamesByInfo(name, birthDate, email);
    }
    
    // 비밀번호 찾기 (보안 질문 확인)
    public User findUserForPasswordReset(String username, String name, String birthDate) {
        return userRepository.findByUsernameAndNameAndBirthDate(username, name, birthDate)
            .orElseThrow(() -> new RuntimeException("일치하는 사용자 정보를 찾을 수 없습니다."));
    }
    
    // 보안 질문 확인
    public boolean verifySecurityAnswer(String username, String securityAnswer) {
        Optional<User> userOpt = userRepository.findByUsername(username);
        if (userOpt.isPresent()) {
            User user = userOpt.get();
            return user.getSecurityAnswer().equals(securityAnswer);
        }
        return false;
    }
    
    // 임시 비밀번호 생성
    public String generateTemporaryPassword() {
        String chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
        StringBuilder password = new StringBuilder();
        
        // 최소 1개의 대문자, 소문자, 숫자, 특수문자 포함
        password.append("ABCDEFGHIJKLMNOPQRSTUVWXYZ".charAt((int)(Math.random() * 26)));
        password.append("abcdefghijklmnopqrstuvwxyz".charAt((int)(Math.random() * 26)));
        password.append("0123456789".charAt((int)(Math.random() * 10)));
        password.append("!@#$%^&*".charAt((int)(Math.random() * 8)));
        
        // 나머지 4자리는 랜덤
        for (int i = 0; i < 4; i++) {
            password.append(chars.charAt((int)(Math.random() * chars.length())));
        }
        
        // 문자열을 섞기
        String result = password.toString();
        char[] charsArray = result.toCharArray();
        for (int i = charsArray.length - 1; i > 0; i--) {
            int j = (int)(Math.random() * (i + 1));
            char temp = charsArray[i];
            charsArray[i] = charsArray[j];
            charsArray[j] = temp;
        }
        
        return new String(charsArray);
    }
    
    // 임시 비밀번호로 비밀번호 변경
    public User resetPasswordWithTemporary(String username, String temporaryPassword) {
        Optional<User> userOpt = userRepository.findByUsername(username);
        if (userOpt.isPresent()) {
            User user = userOpt.get();
            String encodedPassword = passwordEncoder.encode(temporaryPassword);
            user.setPassword(encodedPassword);
            return userRepository.save(user);
        }
        throw new RuntimeException("사용자를 찾을 수 없습니다.");
    }
    
    // 비밀번호 유효성 검사
    private boolean isValidPassword(String password) {
        if (password == null || password.length() < 7) {
            return false;
        }
        
        // 특수문자 포함 여부 확인
        return password.matches(".*[!@#$%^&*()_+\\-=\\[\\]{};':\"\\\\|,.<>\\/?].*");
    }
} 