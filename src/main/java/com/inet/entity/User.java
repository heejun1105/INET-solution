package com.inet.entity;

import java.time.LocalDateTime;
import java.util.List;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class User {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(unique = true, nullable = false)
    private String username; // 아이디
    
    @Column(nullable = false)
    private String password; // 암호화된 비밀번호
    
    @Column(nullable = false)
    private String name; // 이름
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private UserRole role = UserRole.EMPLOYEE; // 기본값 EMPLOYEE
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private UserStatus status = UserStatus.PENDING; // 승인 상태
    
    @Column(name = "birth_date", nullable = false)
    private String birthDate; // 생년월일
    
    @Column(nullable = false)
    private String organization; // 소속
    
    @Column(nullable = false)
    private String position; // 직위
    
    @Column(name = "phone_number", nullable = false)
    private String phoneNumber; // 휴대폰번호
    
    @Column(unique = true, nullable = false)
    private String email; // 이메일
    
    @Column(name = "security_question", nullable = false)
    private String securityQuestion; // 보안 질문
    
    @Column(name = "security_answer", nullable = false)
    private String securityAnswer; // 보안 답변
    
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt; // 가입일
    
    @Column(name = "approved_at")
    private LocalDateTime approvedAt; // 승인일
    
    @Column(name = "approved_by")
    private String approvedBy; // 승인자
    
    @Column(name = "last_login_at")
    private LocalDateTime lastLoginAt; // 마지막 로그인
    
    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private java.util.List<Permission> permissions = new java.util.ArrayList<>();
    
    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private java.util.List<SchoolPermission> schoolPermissions = new java.util.ArrayList<>();
    
    // 생성자 (승인 관련 필드 제외)
    public User(String username, String password, String name, String birthDate, 
                String organization, String position, String phoneNumber, String email,
                String securityQuestion, String securityAnswer) {
        this.username = username;
        this.password = password;
        this.name = name;
        this.birthDate = birthDate;
        this.organization = organization;
        this.position = position;
        this.phoneNumber = phoneNumber;
        this.email = email;
        this.securityQuestion = securityQuestion;
        this.securityAnswer = securityAnswer;
        this.createdAt = LocalDateTime.now();
    }
    
    // 추가 setter 메서드들
    public void setStatus(UserStatus status) {
        this.status = status;
    }
    
    public void setRole(UserRole role) {
        this.role = role;
    }
    
    public void setPassword(String password) {
        this.password = password;
    }
    
    public void setName(String name) {
        this.name = name;
    }
    
    public void setBirthDate(String birthDate) {
        this.birthDate = birthDate;
    }
    
    public void setOrganization(String organization) {
        this.organization = organization;
    }
    
    public void setPosition(String position) {
        this.position = position;
    }
    
    public void setPhoneNumber(String phoneNumber) {
        this.phoneNumber = phoneNumber;
    }
    
    public void setEmail(String email) {
        this.email = email;
    }
    
    public void setSecurityQuestion(String securityQuestion) {
        this.securityQuestion = securityQuestion;
    }
    
    public void setSecurityAnswer(String securityAnswer) {
        this.securityAnswer = securityAnswer;
    }
    
    public void setApprovedAt(LocalDateTime approvedAt) {
        this.approvedAt = approvedAt;
    }
    
    public void setApprovedBy(String approvedBy) {
        this.approvedBy = approvedBy;
    }
    
    public void setLastLoginAt(LocalDateTime lastLoginAt) {
        this.lastLoginAt = lastLoginAt;
    }
    
    // 추가 getter 메서드들
    public Long getId() {
        return this.id;
    }
    
    public String getUsername() {
        return this.username;
    }
    
    public String getPassword() {
        return this.password;
    }
    
    public String getName() {
        return this.name;
    }
    
    public UserRole getRole() {
        return this.role;
    }
    
    public UserStatus getStatus() {
        return this.status;
    }
    
    public String getBirthDate() {
        return this.birthDate;
    }
    
    public String getOrganization() {
        return this.organization;
    }
    
    public String getPosition() {
        return this.position;
    }
    
    public String getPhoneNumber() {
        return this.phoneNumber;
    }
    
    public String getEmail() {
        return this.email;
    }
    
    public String getSecurityQuestion() {
        return this.securityQuestion;
    }
    
    public String getSecurityAnswer() {
        return this.securityAnswer;
    }
    
    public LocalDateTime getCreatedAt() {
        return this.createdAt;
    }
    
    public LocalDateTime getApprovedAt() {
        return this.approvedAt;
    }
    
    public String getApprovedBy() {
        return this.approvedBy;
    }
    
    public LocalDateTime getLastLoginAt() {
        return this.lastLoginAt;
    }
    
    public java.util.List<Permission> getPermissions() {
        return this.permissions;
    }
    
    public void setPermissions(java.util.List<Permission> permissions) {
        this.permissions = permissions;
    }
    
    // 권한 추가 메서드
    public void addPermission(Permission permission) {
        this.permissions.add(permission);
        permission.setUser(this);
    }
    
    // 권한 제거 메서드
    public void removePermission(Permission permission) {
        this.permissions.remove(permission);
        permission.setUser(null);
    }
    
    public java.util.List<SchoolPermission> getSchoolPermissions() {
        return this.schoolPermissions;
    }

    public void setSchoolPermissions(java.util.List<SchoolPermission> schoolPermissions) {
        this.schoolPermissions = schoolPermissions;
    }

    public void addSchoolPermission(SchoolPermission schoolPermission) {
        this.schoolPermissions.add(schoolPermission);
        schoolPermission.setUser(this);
    }

    public void removeSchoolPermission(SchoolPermission schoolPermission) {
        this.schoolPermissions.remove(schoolPermission);
        schoolPermission.setUser(null);
    }
} 