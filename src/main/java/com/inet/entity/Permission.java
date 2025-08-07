package com.inet.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Entity
@Table(name = "permissions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Permission {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;
    
    @Column(name = "feature", nullable = false)
    @Enumerated(EnumType.STRING)
    private Feature feature; // 기능
    
    @Column(name = "created_at", nullable = false)
    private java.time.LocalDateTime createdAt;

    public Permission(User user, Feature feature) {
        this.user = user;
        this.feature = feature;
        this.createdAt = java.time.LocalDateTime.now();
    }
    
    public void setUser(User user) {
        this.user = user;
    }
    
    public Feature getFeature() {
        return this.feature;
    }
} 