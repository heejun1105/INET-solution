package com.jaein.school.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "schools")
@Getter @Setter
public class School {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long schoolId;
    
    @Column(nullable = false)
    private String schoolName;
    
    @Column(nullable = false)
    private String ipPrefix;
} 