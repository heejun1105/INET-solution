package com.inet.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Entity
@Table(name = "school_permissions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class SchoolPermission {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "school_id", nullable = false)
    private School school;
    
    @Column(name = "created_at", nullable = false)
    private java.time.LocalDateTime createdAt;

    public SchoolPermission(User user, School school) {
        this.user = user;
        this.school = school;
        this.createdAt = java.time.LocalDateTime.now();
    }
    
    public void setUser(User user) {
        this.user = user;
    }
    
    public School getSchool() {
        return this.school;
    }
    
    public void setSchool(School school) {
        this.school = school;
    }
} 